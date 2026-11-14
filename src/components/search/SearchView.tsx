import { useLiveQuery } from 'dexie-react-hooks';
import { AlertTriangle, BookmarkPlus, Filter, Search, Sparkles, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createSmartCollection, uid } from '../../db/actions';
import { db } from '../../db/database';
import { detectBrokenLinks, detectDuplicateNotes, detectOrphanNotes } from '../../lib/links';
import { evaluateSmartCollection, searchWorkspaceEntities } from '../../lib/search';
import { useUIStore } from '../../store/useUIStore';

type SearchEntityFilter = 'all' | 'notes' | 'tasks' | 'bookmarks' | 'snippets' | 'attachments';

const ENTITY_LABELS: Record<SearchEntityFilter, string> = {
  all: 'All Types',
  notes: 'Notes',
  tasks: 'Tasks',
  bookmarks: 'Saved Links',
  snippets: 'Snippets',
  attachments: 'Files & PDFs',
};

function isSearchEntityFilter(value: string): value is SearchEntityFilter {
  return (
    value === 'all' ||
    value === 'notes' ||
    value === 'tasks' ||
    value === 'bookmarks' ||
    value === 'snippets' ||
    value === 'attachments'
  );
}

export function SearchView() {
  const {
    activeWorkspaceId,
    setSelectedNoteId,
    setSelectedAttachmentId,
    setActiveView,
    showToast,
  } = useUIStore();

  const [tab, setTab] = useState<'search' | 'smart' | 'diagnostics'>('search');
  const [query, setQuery] = useState('');
  const [kindFilter, setKindFilter] = useState<SearchEntityFilter>('all');
  const [tagFilter, setTagFilter] = useState('');
  const [scope, setScope] = useState<'all' | 'current'>('all');
  const [includeArchived, setIncludeArchived] = useState(false);

  const [smartName, setSmartName] = useState('');
  const [smartTag, setSmartTag] = useState('');
  const [smartPinnedOnly, setSmartPinnedOnly] = useState(false);
  const [smartDays, setSmartDays] = useState('');
  const [selectedSmartId, setSelectedSmartId] = useState<string>('smt-1');

  const notes = useLiveQuery(() => db.notes.toArray(), [], []);
  const tasks = useLiveQuery(() => db.tasks.toArray(), [], []);
  const bookmarks = useLiveQuery(() => db.bookmarks.toArray(), [], []);
  const snippets = useLiveQuery(() => db.snippets.toArray(), [], []);
  const attachments = useLiveQuery(() => db.attachments.toArray(), [], []);
  const savedSearches = useLiveQuery(
    () => db.savedSearches.orderBy('createdAt').reverse().toArray(),
    [],
    [],
  );
  const smartCollections = useLiveQuery(
    () => db.smartCollections.orderBy('createdAt').toArray(),
    [],
    [],
  );

  const searchResults = useMemo(
    () =>
      searchWorkspaceEntities(
        { notes, tasks, bookmarks, snippets, attachments },
        {
          query,
          workspaceId: scope === 'current' ? activeWorkspaceId : 'all',
          kind: kindFilter,
          tagFilter,
          includeArchived,
        },
      ),
    [
      notes,
      tasks,
      bookmarks,
      snippets,
      attachments,
      query,
      scope,
      activeWorkspaceId,
      kindFilter,
      tagFilter,
      includeArchived,
    ],
  );

  const activeSmart =
    smartCollections.find((s) => s.id === selectedSmartId) ?? smartCollections[0] ?? null;
  const smartNotes = useMemo(
    () => (activeSmart ? evaluateSmartCollection(notes, activeSmart.rule) : []),
    [notes, activeSmart],
  );

  const brokenLinks = useMemo(() => detectBrokenLinks(notes), [notes]);
  const orphanNotes = useMemo(() => detectOrphanNotes(notes), [notes]);
  const duplicates = useMemo(() => detectDuplicateNotes(notes), [notes]);

  async function handleSaveSearch() {
    const label = query.trim() || tagFilter.trim() || `Search (${kindFilter})`;
    await db.savedSearches.put({
      id: uid('sch'),
      name: label,
      query,
      entityFilter: kindFilter,
      tagFilter,
      workspaceId: scope === 'current' ? activeWorkspaceId : 'all',
      createdAt: Date.now(),
    });
    showToast('Saved search');
  }

  async function handleCreateSmartCollection(e: React.FormEvent) {
    e.preventDefault();
    if (!smartName.trim()) return;
    const created = await createSmartCollection(smartName, 'Custom smart view', {
      workspaceId: 'all',
      tag: smartTag.trim() || undefined,
      pinnedOnly: smartPinnedOnly || undefined,
      updatedWithinDays: smartDays ? Number(smartDays) : undefined,
    });
    setSelectedSmartId(created.id);
    setSmartName('');
    setSmartTag('');
    setSmartDays('');
    setSmartPinnedOnly(false);
    showToast('Created smart view');
  }

  return (
    <div className="flex-1 overflow-y-auto px-3.5 pt-4 content-pb-mobile sm:px-6 sm:pt-5 md:pb-10 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-4 sm:space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Search & Smart Views
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Find anything saved on your device across notes, tasks, links, and files.
            </p>
          </div>

          <Tabs
            value={tab}
            onValueChange={(value) => {
              if (value === 'search' || value === 'smart' || value === 'diagnostics') {
                setTab(value);
              }
            }}
          >
            <div className="no-scrollbar overflow-x-auto pb-0.5">
              <TabsList className="h-11 w-max min-w-full justify-start gap-1 rounded-2xl bg-muted/65 p-1 backdrop-blur-md">
                <TabsTrigger
                  value="search"
                  className="min-h-[36px] rounded-xl px-3 sm:px-3.5 text-xs"
                >
                  Search
                </TabsTrigger>
                <TabsTrigger
                  value="smart"
                  className="min-h-[36px] rounded-xl px-3 sm:px-3.5 text-xs"
                >
                  Smart Views
                </TabsTrigger>
                <TabsTrigger
                  value="diagnostics"
                  className="min-h-[36px] rounded-xl px-3 sm:px-3.5 text-xs"
                >
                  Note Health ({brokenLinks.length + orphanNotes.length + duplicates.length})
                </TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </div>

        {tab === 'search' && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="space-y-4 lg:col-span-2">
              <Card className="gap-0 p-3.5 sm:p-4">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search notes, tasks, links, files..."
                    aria-label="Full-text search query"
                    className="min-h-[40px] min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void handleSaveSearch()}
                    className="min-h-[38px] shrink-0 gap-1.5 rounded-xl px-3 text-xs"
                  >
                    <BookmarkPlus className="h-3.5 w-3.5 text-primary" />
                    Save
                  </Button>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5 sm:gap-2 border-t border-border/60 pt-3 text-xs">
                  <Select
                    value={kindFilter}
                    onValueChange={(value) => {
                      if (value && isSearchEntityFilter(value)) setKindFilter(value);
                    }}
                  >
                    <SelectTrigger
                      aria-label="Filter entity type"
                      className="h-9 flex-1 sm:flex-none sm:min-w-[126px] rounded-xl bg-background/50 px-2.5 text-xs"
                    >
                      <SelectValue>{ENTITY_LABELS[kindFilter]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Types</SelectItem>
                      <SelectItem value="notes">Notes</SelectItem>
                      <SelectItem value="tasks">Tasks</SelectItem>
                      <SelectItem value="bookmarks">Saved Links</SelectItem>
                      <SelectItem value="snippets">Snippets</SelectItem>
                      <SelectItem value="attachments">Files & PDFs</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select
                    value={scope}
                    onValueChange={(value) => {
                      if (value === 'all' || value === 'current') setScope(value);
                    }}
                  >
                    <SelectTrigger
                      aria-label="Workspace scope"
                      className="h-9 flex-1 sm:flex-none sm:min-w-[132px] rounded-xl bg-background/50 px-2.5 text-xs"
                    >
                      <SelectValue>{scope === 'all' ? 'All Spaces' : 'Current Space'}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Spaces</SelectItem>
                      <SelectItem value="current">Current Space</SelectItem>
                    </SelectContent>
                  </Select>

                  <Input
                    type="text"
                    value={tagFilter}
                    onChange={(e) => setTagFilter(e.target.value)}
                    placeholder="Filter #tag..."
                    aria-label="Filter by tag"
                    className="h-9 w-full sm:w-28 rounded-xl bg-background/50 px-2.5 text-xs"
                  />

                  <label className="inline-flex min-h-[36px] cursor-pointer items-center gap-1.5 text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={includeArchived}
                      onChange={(e) => setIncludeArchived(e.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    Archived
                  </label>
                </div>
              </Card>

              <div className="space-y-2">
                <div className="text-xs font-medium text-muted-foreground">
                  <span className="font-mono tabular-nums">{searchResults.length}</span> results
                </div>
                {searchResults.length === 0 ? (
                  <Card className="p-8 text-center text-xs text-muted-foreground">
                    No items match these filters.
                  </Card>
                ) : (
                  <Card className="gap-0 py-0">
                    <CardContent className="divide-y divide-border/60 p-0">
                      {searchResults.map((hit) => (
                        <button
                          key={`${hit.kind}-${hit.id}`}
                          type="button"
                          onClick={() => {
                            if (hit.kind === 'note') setSelectedNoteId(hit.id);
                            else if (hit.kind === 'task') setActiveView('tasks');
                            else if (hit.kind === 'attachment') {
                              setSelectedAttachmentId(hit.id);
                              setActiveView('pdf');
                            } else {
                              setActiveView('snippets');
                            }
                          }}
                          className="block min-h-[60px] w-full p-4 text-left transition-colors hover:bg-muted/40"
                        >
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-medium capitalize text-primary">{hit.kind}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono tabular-nums">
                              {new Date(hit.updatedAt).toLocaleDateString()}
                            </span>
                            {hit.tags.length > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{hit.tags.map((t) => `#${t}`).join(' ')}</span>
                              </>
                            )}
                          </div>
                          <div className="mt-1 font-display text-sm font-semibold text-foreground">
                            {hit.title}
                          </div>
                          {hit.excerpt && (
                            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                              {hit.excerpt}
                            </p>
                          )}
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Saved Searches */}
            <div className="space-y-3">
              <Card className="gap-0 p-4">
                <CardHeader className="p-0 pb-3">
                  <CardTitle className="flex items-center gap-1.5 font-display text-sm font-semibold">
                    <Filter className="h-3.5 w-3.5 text-primary" />
                    Saved Searches
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 p-0">
                  {savedSearches.length === 0 ? (
                    <p className="text-xs text-muted-foreground">
                      Save frequent searches for one-tap access later.
                    </p>
                  ) : (
                    savedSearches.map((saved) => (
                      <div
                        key={saved.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-border/70 bg-background/50 px-3 py-2"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            setQuery(saved.query);
                            setKindFilter(saved.entityFilter);
                            setTagFilter(saved.tagFilter);
                            setScope(saved.workspaceId === 'all' ? 'all' : 'current');
                          }}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="truncate text-xs font-medium text-foreground">
                            {saved.name}
                          </div>
                          <div className="truncate text-[11px] text-muted-foreground">
                            {saved.entityFilter} {saved.tagFilter ? `· #${saved.tagFilter}` : ''}
                          </div>
                        </button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => void db.savedSearches.delete(saved.id)}
                          aria-label={`Delete saved search ${saved.name}`}
                          className="min-h-[36px] min-w-[36px] rounded-lg text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {tab === 'smart' && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <div className="space-y-4">
              <Card className="gap-0 p-4">
                <CardHeader className="p-0 pb-3">
                  <CardTitle className="flex items-center gap-1.5 font-display text-sm font-semibold">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                    Smart Views
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-1.5 p-0">
                  {smartCollections.map((sc) => (
                    <button
                      key={sc.id}
                      type="button"
                      onClick={() => setSelectedSmartId(sc.id)}
                      className={`block min-h-[48px] w-full rounded-xl border px-3 py-2 text-left transition-colors ${
                        activeSmart?.id === sc.id
                          ? 'border-primary bg-secondary/70'
                          : 'border-border/70 bg-background/40 hover:bg-muted/50'
                      }`}
                    >
                      <div className="text-xs font-semibold text-foreground">{sc.name}</div>
                      <div className="text-[11px] text-muted-foreground">{sc.description}</div>
                    </button>
                  ))}
                </CardContent>
              </Card>

              <Card className="gap-0 p-4">
                <form onSubmit={(e) => void handleCreateSmartCollection(e)} className="space-y-2.5">
                  <h3 className="font-display text-xs font-semibold text-muted-foreground">
                    New Smart Filter
                  </h3>
                  <Input
                    type="text"
                    value={smartName}
                    onChange={(e) => setSmartName(e.target.value)}
                    placeholder="View name..."
                    aria-label="Smart collection name"
                    className="h-10 rounded-xl bg-background/50 px-3 text-xs"
                  />
                  <Input
                    type="text"
                    value={smartTag}
                    onChange={(e) => setSmartTag(e.target.value)}
                    placeholder="Required tag (optional)"
                    aria-label="Required tag"
                    className="h-10 rounded-xl bg-background/50 px-3 text-xs"
                  />
                  <Input
                    type="number"
                    min={1}
                    value={smartDays}
                    onChange={(e) => setSmartDays(e.target.value)}
                    placeholder="Edited within N days (optional)"
                    aria-label="Updated within days"
                    className="h-10 rounded-xl bg-background/50 px-3 text-xs"
                  />
                  <label className="flex min-h-[36px] cursor-pointer items-center gap-2 text-xs text-foreground">
                    <input
                      type="checkbox"
                      checked={smartPinnedOnly}
                      onChange={(e) => setSmartPinnedOnly(e.target.checked)}
                      className="h-4 w-4 accent-primary"
                    />
                    Pinned notes only
                  </label>
                  <Button
                    type="submit"
                    className="min-h-[42px] w-full rounded-xl text-xs font-semibold"
                  >
                    Create Smart View
                  </Button>
                </form>
              </Card>
            </div>

            <div className="lg:col-span-2">
              <Card className="gap-0 p-5">
                <div className="flex items-center justify-between border-b border-border/60 pb-3">
                  <div>
                    <h2 className="font-display text-base font-semibold text-foreground">
                      {activeSmart?.name ?? 'Smart View'}
                    </h2>
                    <p className="text-xs text-muted-foreground">{activeSmart?.description}</p>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-muted-foreground">
                    {smartNotes.length} notes
                  </span>
                </div>
                <div className="mt-2 divide-y divide-border/60">
                  {smartNotes.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => setSelectedNoteId(n.id)}
                      className="block min-h-[54px] w-full py-3 text-left transition-opacity hover:opacity-80"
                    >
                      <div className="font-display text-sm font-semibold text-foreground">
                        {n.title}
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        {n.wordCount} words · {n.tags.map((t) => `#${t}`).join(' ')}
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          </div>
        )}

        {tab === 'diagnostics' && (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            <Card className="gap-0 p-4">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="flex items-center gap-1.5 font-display text-sm font-semibold">
                  <AlertTriangle className="h-4 w-4 text-primary" />
                  Missing Note Links ({brokenLinks.length})
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Links pointing to note titles that have not been created yet.
                </p>
              </CardHeader>
              <CardContent className="space-y-2 p-0">
                {brokenLinks.length === 0 ? (
                  <p className="text-xs text-primary">All note links connect cleanly.</p>
                ) : (
                  brokenLinks.map((issue) => (
                    <button
                      key={`${issue.noteId}-${issue.missingTarget}`}
                      type="button"
                      onClick={() => setSelectedNoteId(issue.noteId)}
                      className="block w-full rounded-xl border border-border/70 bg-background/50 p-3 text-left text-xs transition-colors hover:border-primary"
                    >
                      <div className="font-semibold text-foreground">[[{issue.missingTarget}]]</div>
                      <div className="text-muted-foreground">In {issue.noteTitle}</div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="gap-0 p-4">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="font-display text-sm font-semibold">
                  Unconnected Notes ({orphanNotes.length})
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Notes without any links to or from other notes.
                </p>
              </CardHeader>
              <CardContent className="space-y-2 p-0">
                {orphanNotes.length === 0 ? (
                  <p className="text-xs text-primary">Every active note is connected.</p>
                ) : (
                  orphanNotes.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => setSelectedNoteId(n.id)}
                      className="block w-full rounded-xl border border-border/70 bg-background/50 p-3 text-left text-xs transition-colors hover:border-primary"
                    >
                      <div className="font-semibold text-foreground">{n.title}</div>
                      <div className="text-muted-foreground">{n.wordCount} words</div>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="gap-0 p-4">
              <CardHeader className="p-0 pb-3">
                <CardTitle className="font-display text-sm font-semibold">
                  Possible Duplicates ({duplicates.length})
                </CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">
                  Notes sharing identical titles or matching text.
                </p>
              </CardHeader>
              <CardContent className="space-y-2 p-0">
                {duplicates.length === 0 ? (
                  <p className="text-xs text-primary">No duplicate notes found.</p>
                ) : (
                  duplicates.map((grp) => (
                    <div
                      key={`${grp.reason}-${grp.key}`}
                      className="rounded-xl border border-border/70 bg-background/50 p-3 text-xs"
                    >
                      <div className="font-semibold capitalize text-foreground">
                        Same {grp.reason}: {grp.key}
                      </div>
                      <div className="mt-1 space-y-1">
                        {grp.notes.map((n) => (
                          <Button
                            key={n.id}
                            type="button"
                            variant="link"
                            size="xs"
                            onClick={() => setSelectedNoteId(n.id)}
                            className="block h-auto px-0 text-xs text-primary"
                          >
                            {n.title}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
