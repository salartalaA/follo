import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowUpDown, Download, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { addCollectionRow, createStructuredCollection, uid } from '../../db/actions';
import { db } from '../../db/database';
import { exportCollectionAsSpreadsheet } from '../../services/exportImport';
import { useUIStore } from '../../store/useUIStore';
import type {
  CollectionCellValue,
  CollectionFieldType,
  CollectionRow,
} from '../../types/workspace';

const FIELD_TYPE_LABELS: Record<CollectionFieldType, string> = {
  text: 'Text',
  number: 'Number',
  select: 'Select',
  date: 'Date',
  checkbox: 'Checkbox',
  url: 'URL',
};

function isCollectionFieldType(value: string): value is CollectionFieldType {
  return (
    value === 'text' ||
    value === 'number' ||
    value === 'select' ||
    value === 'date' ||
    value === 'checkbox' ||
    value === 'url'
  );
}

export function CollectionsView() {
  const { activeWorkspaceId, selectedCollectionId, setSelectedCollectionId, showToast } =
    useUIStore();

  const [newCollectionName, setNewCollectionName] = useState('');
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState<CollectionFieldType>('text');
  const [filterText, setFilterText] = useState('');
  const [sortFieldId, setSortFieldId] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const collections = useLiveQuery(
    () => db.collections.orderBy('updatedAt').reverse().toArray(),
    [],
    [],
  );
  const activeCollection =
    collections.find((c) => c.id === selectedCollectionId) ?? collections[0] ?? null;

  const rows = useLiveQuery(
    () =>
      activeCollection
        ? db.collectionRows.where('collectionId').equals(activeCollection.id).toArray()
        : Promise.resolve<CollectionRow[]>([]),
    [activeCollection?.id],
    [] as CollectionRow[],
  );

  const visibleRows = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) =>
          Object.values(r.values).some((v) =>
            String(v ?? '')
              .toLowerCase()
              .includes(q),
          ),
        )
      : rows;

    if (!sortFieldId) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a.values[sortFieldId];
      const bv = b.values[sortFieldId];
      const cmp = String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [rows, filterText, sortFieldId, sortDir]);

  async function handleCreateCollection(e: React.FormEvent) {
    e.preventDefault();
    if (!newCollectionName.trim()) return;
    const created = await createStructuredCollection(
      activeWorkspaceId,
      newCollectionName.trim(),
      'Custom local list & table',
      [
        { id: 'f-name', name: 'Name', type: 'text' },
        { id: 'f-status', name: 'Status', type: 'select', options: ['Draft', 'Active', 'Done'] },
        { id: 'f-score', name: 'Score', type: 'number' },
      ],
    );
    setSelectedCollectionId(created.id);
    setNewCollectionName('');
    showToast(`Created "${created.name}"`);
  }

  async function handleAddField(e: React.FormEvent) {
    e.preventDefault();
    if (!activeCollection || !newFieldName.trim()) return;
    const updatedFields = [
      ...activeCollection.fields,
      {
        id: uid('fld'),
        name: newFieldName.trim(),
        type: newFieldType,
        options: newFieldType === 'select' ? ['Option A', 'Option B', 'Option C'] : undefined,
      },
    ];
    await db.collections.update(activeCollection.id, {
      fields: updatedFields,
      updatedAt: Date.now(),
    });
    setNewFieldName('');
    showToast('Added column');
  }

  async function handleAddRow() {
    if (!activeCollection) return;
    const initial: Record<string, CollectionCellValue> = {};
    for (const f of activeCollection.fields) {
      initial[f.id] =
        f.type === 'checkbox'
          ? false
          : f.type === 'number'
            ? 0
            : f.type === 'select'
              ? (f.options?.[0] ?? 'Option A')
              : '';
    }
    await addCollectionRow(activeCollection.id, activeCollection.workspaceId, initial);
  }

  async function handleCellChange(rowId: string, fieldId: string, value: CollectionCellValue) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;
    await db.collectionRows.update(rowId, {
      values: { ...row.values, [fieldId]: value },
      updatedAt: Date.now(),
    });
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
      {/* Desktop Left Picker / Mobile Top Horizontal Strip */}
      <div className="shrink-0 border-b border-border/60 bg-card/45 p-3.5 sm:p-4 backdrop-blur-xl lg:w-64 lg:border-b-0 lg:border-r">
        <h2 className="font-display text-sm font-semibold text-foreground">Lists & Tables</h2>
        <div className="no-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-1 lg:flex-col lg:space-y-1 lg:overflow-visible">
          {collections.map((col) => {
            const active = activeCollection?.id === col.id;
            return (
              <Button
                key={col.id}
                type="button"
                variant={active ? 'secondary' : 'ghost'}
                onClick={() => setSelectedCollectionId(col.id)}
                className={`min-h-[38px] shrink-0 justify-start rounded-xl px-3 text-xs whitespace-nowrap active:scale-95 transition-all lg:w-full lg:truncate ${
                  active ? 'font-semibold text-foreground' : 'text-muted-foreground'
                }`}
              >
                {col.name}
              </Button>
            );
          })}
        </div>

        <form
          onSubmit={(e) => void handleCreateCollection(e)}
          className="mt-3 flex gap-2 border-t border-border/60 pt-3 lg:flex-col"
        >
          <Input
            type="text"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            placeholder="New list or table..."
            aria-label="New collection name"
            className="h-9 min-w-0 flex-1 rounded-xl bg-background/50 px-3 text-xs"
          />
          <Button
            type="submit"
            className="min-h-[38px] shrink-0 rounded-xl px-3.5 text-xs font-semibold active:scale-95 transition-transform"
          >
            Create Table
          </Button>
        </form>
      </div>

      {/* Main Table Canvas */}
      <div className="flex-1 overflow-auto px-3.5 pt-4 content-pb-mobile sm:px-6 sm:pt-5 md:pb-10">
        {!activeCollection ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Create a list or table to organize custom fields and items.
          </div>
        ) : (
          <div className="mx-auto max-w-5xl space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="font-display text-lg sm:text-xl font-bold text-foreground">
                  {activeCollection.name}
                </h1>
                <p className="text-xs text-muted-foreground">{activeCollection.description}</p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <Input
                  type="text"
                  value={filterText}
                  onChange={(e) => setFilterText(e.target.value)}
                  placeholder="Filter rows..."
                  aria-label="Filter collection rows"
                  className="h-9 w-full rounded-xl bg-card/60 px-3 text-xs sm:w-44"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    exportCollectionAsSpreadsheet(activeCollection, visibleRows, 'csv')
                  }
                  className="min-h-[38px] flex-1 sm:flex-none gap-1 rounded-xl bg-card/60 px-3 text-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  CSV
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    exportCollectionAsSpreadsheet(activeCollection, visibleRows, 'xlsx')
                  }
                  className="min-h-[38px] flex-1 sm:flex-none gap-1 rounded-xl bg-card/60 px-3 text-xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  XLSX
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleAddRow()}
                  className="min-h-[38px] flex-1 sm:flex-none gap-1 rounded-xl px-3.5 text-xs font-semibold active:scale-95 transition-transform"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Row
                </Button>
              </div>
            </div>

            {/* Table */}
            <Card className="gap-0 overflow-x-auto py-0">
              <table className="w-full min-w-[540px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-border/60 bg-muted/45">
                    {activeCollection.fields.map((field) => (
                      <th key={field.id} className="px-3 py-3 font-semibold text-foreground">
                        <button
                          type="button"
                          onClick={() => {
                            if (sortFieldId === field.id) {
                              setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
                            } else {
                              setSortFieldId(field.id);
                              setSortDir('asc');
                            }
                          }}
                          className="inline-flex items-center gap-1 hover:text-primary"
                        >
                          <span>{field.name}</span>
                          <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                        </button>
                      </th>
                    ))}
                    <th className="w-10 px-2 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {visibleRows.map((row) => (
                    <tr key={row.id} className="hover:bg-muted/30">
                      {activeCollection.fields.map((field) => {
                        const val = row.values[field.id];
                        const selectOptions =
                          field.options && field.options.length > 0
                            ? field.options
                            : ['Option A', 'Option B'];
                        const safeSelectVal = selectOptions.includes(String(val ?? ''))
                          ? String(val)
                          : selectOptions[0];

                        return (
                          <td key={field.id} className="px-3 py-2.5">
                            {field.type === 'checkbox' ? (
                              <input
                                type="checkbox"
                                checked={Boolean(val)}
                                aria-label={`${field.name} row ${row.id}`}
                                onChange={(e) =>
                                  void handleCellChange(row.id, field.id, e.target.checked)
                                }
                                className="h-4 w-4 accent-primary"
                              />
                            ) : field.type === 'select' ? (
                              <Select
                                value={safeSelectVal}
                                onValueChange={(nextVal) => {
                                  if (nextVal) void handleCellChange(row.id, field.id, nextVal);
                                }}
                              >
                                <SelectTrigger
                                  size="sm"
                                  aria-label={`${field.name} row ${row.id}`}
                                  className="h-8 w-full min-w-[100px] border-transparent bg-transparent px-2 text-xs hover:bg-muted/50"
                                >
                                  <SelectValue>{safeSelectVal}</SelectValue>
                                </SelectTrigger>
                                <SelectContent>
                                  {selectOptions.map((opt) => (
                                    <SelectItem key={opt} value={opt}>
                                      {opt}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            ) : (
                              <input
                                type={
                                  field.type === 'number'
                                    ? 'number'
                                    : field.type === 'date'
                                      ? 'date'
                                      : 'text'
                                }
                                value={val === null || val === undefined ? '' : String(val)}
                                aria-label={`${field.name} row ${row.id}`}
                                onChange={(e) =>
                                  void handleCellChange(
                                    row.id,
                                    field.id,
                                    field.type === 'number'
                                      ? Number(e.target.value)
                                      : e.target.value,
                                  )
                                }
                                className={`min-h-[34px] w-full bg-transparent text-foreground outline-none ${
                                  field.type === 'number' || field.type === 'date'
                                    ? 'font-mono tabular-nums'
                                    : ''
                                }`}
                              />
                            )}
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => void db.collectionRows.delete(row.id)}
                          aria-label="Delete row"
                          className="min-h-[36px] min-w-[36px] rounded-lg text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* Add Custom Field */}
            <Card className="gap-0 p-3.5">
              <form
                onSubmit={(e) => void handleAddField(e)}
                className="flex flex-wrap items-center gap-2"
              >
                <span className="text-xs font-medium text-muted-foreground">Add Column:</span>
                <Input
                  type="text"
                  value={newFieldName}
                  onChange={(e) => setNewFieldName(e.target.value)}
                  placeholder="Column name..."
                  aria-label="New field name"
                  className="h-10 min-w-36 flex-1 rounded-xl bg-background/50 px-3 text-xs sm:flex-initial"
                />
                <Select
                  value={newFieldType}
                  onValueChange={(value) => {
                    if (value && isCollectionFieldType(value)) setNewFieldType(value);
                  }}
                >
                  <SelectTrigger
                    aria-label="New field type"
                    className="h-10 min-w-[110px] rounded-xl bg-background/50 px-3 text-xs"
                  >
                    <SelectValue>{FIELD_TYPE_LABELS[newFieldType]}</SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                    <SelectItem value="select">Select</SelectItem>
                    <SelectItem value="date">Date</SelectItem>
                    <SelectItem value="checkbox">Checkbox</SelectItem>
                    <SelectItem value="url">URL</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  type="submit"
                  variant="secondary"
                  className="min-h-[40px] rounded-xl px-4 text-xs font-semibold"
                >
                  Add Column
                </Button>
              </form>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
