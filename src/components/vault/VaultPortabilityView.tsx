import { useLiveQuery } from 'dexie-react-hooks';
import { Archive, CheckCircle2, Download, FileUp, ShieldCheck, Upload, Wrench } from 'lucide-react';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { db } from '../../db/database';
import { type IntegrityReport, runIntegrityAudit } from '../../lib/integrity';
import { validateBackupPayload, type WorkspaceBackupPayload } from '../../lib/validators';
import {
  exportFullWorkspaceJson,
  exportFullWorkspaceZip,
  importDocumentFile,
  restoreFromBackupPayload,
} from '../../services/exportImport';
import { useUIStore } from '../../store/useUIStore';

export function VaultPortabilityView() {
  const { activeWorkspaceId, showToast } = useUIStore();

  const [importStatus, setImportStatus] = useState('');
  const [importError, setImportError] = useState('');
  const [exportBusy, setExportBusy] = useState(false);

  const [pendingBackup, setPendingBackup] = useState<WorkspaceBackupPayload | null>(null);
  const [restoreScopes, setRestoreScopes] = useState({
    workspaces: true,
    notes: true,
    tasks: true,
    collections: true,
    snippetsAndBookmarks: true,
    mode: 'merge' as 'merge' | 'replace',
  });

  const [integrityReport, setIntegrityReport] = useState<IntegrityReport | null>(null);
  const backupInputRef = useRef<HTMLInputElement | null>(null);

  const counts = useLiveQuery(async () => {
    const [notes, tasks, collections, attachments, snippets, bookmarks] = await Promise.all([
      db.notes.count(),
      db.tasks.count(),
      db.collections.count(),
      db.attachments.count(),
      db.snippets.count(),
      db.bookmarks.count(),
    ]);
    return { notes, tasks, collections, attachments, snippets, bookmarks };
  }, []);

  async function handleImportDocuments(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setImportError('');
    setImportStatus('Importing...');
    try {
      const summaries: string[] = [];
      for (const file of files) {
        const res = await importDocumentFile(file, activeWorkspaceId);
        summaries.push(res.summary);
      }
      setImportStatus(summaries.join(' '));
      showToast('Import complete');
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Import failed.');
      setImportStatus('');
    }
  }

  async function handleLoadBackupJson(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError('');
    try {
      const raw: unknown = JSON.parse(await file.text());
      const validation = validateBackupPayload(raw);
      if (!validation.valid || !validation.payload) {
        setImportError(`Invalid backup file: ${validation.errors.join(' ')}`);
        setPendingBackup(null);
        return;
      }
      setPendingBackup(validation.payload);
      setImportStatus(
        `Ready to restore backup from ${new Date(validation.payload.exportedAt).toLocaleString()}.`,
      );
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not read JSON backup.');
    }
  }

  async function handleApplySelectiveRestore() {
    if (!pendingBackup) return;
    await restoreFromBackupPayload(pendingBackup, restoreScopes);
    setPendingBackup(null);
    showToast('Backup restored');
  }

  async function handleRunIntegrityCheck() {
    const [workspaces, folders, notes, tasks, collections, collectionRows, attachments] =
      await Promise.all([
        db.workspaces.toArray(),
        db.folders.toArray(),
        db.notes.toArray(),
        db.tasks.toArray(),
        db.collections.toArray(),
        db.collectionRows.toArray(),
        db.attachments.toArray(),
      ]);
    const report = runIntegrityAudit({
      workspaces,
      folders,
      notes,
      tasks,
      collections,
      collectionRows,
      attachments,
    });
    setIntegrityReport(report);
  }

  async function handleAutoRepair() {
    if (!integrityReport) return;
    for (const df of integrityReport.danglingFolders) {
      await db.notes.update(df.noteId, { folderId: null });
    }
    for (const dt of integrityReport.danglingTaskNotes) {
      await db.tasks.update(dt.taskId, { linkedNoteId: null });
    }
    for (const dr of integrityReport.danglingCollectionRows) {
      await db.collectionRows.delete(dr.rowId);
    }
    await handleRunIntegrityCheck();
    showToast('Repaired links');
  }

  return (
    <div className="flex-1 overflow-y-auto px-3.5 pt-4 content-pb-mobile sm:px-6 sm:pt-5 md:pb-10 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-4 sm:space-y-5">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
            Backup, Import & Export
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your data stays privately on this device. Bring in files, download backups, or verify
            your workspace health.
          </p>
        </div>

        {/* Summary Strip */}
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: 'Notes', value: counts?.notes ?? 0 },
            { label: 'Tasks', value: counts?.tasks ?? 0 },
            { label: 'Tables', value: counts?.collections ?? 0 },
            { label: 'Files', value: counts?.attachments ?? 0 },
            { label: 'Snippets', value: counts?.snippets ?? 0 },
            { label: 'Links', value: counts?.bookmarks ?? 0 },
          ].map((stat) => (
            <Card key={stat.label} className="gap-0 p-3.5">
              <dt className="text-xs text-muted-foreground">{stat.label}</dt>
              <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">
                {stat.value}
              </dd>
            </Card>
          ))}
        </dl>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Import Files */}
          <Card className="gap-0 p-5">
            <CardHeader className="p-0 pb-3">
              <CardTitle className="flex items-center gap-2 font-display text-base font-semibold">
                <FileUp className="h-4 w-4 text-primary" />
                Import Documents & Lists
              </CardTitle>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Supports{' '}
                <strong>TXT, Markdown, HTML, PDF, Word (.docx), RTF, CSV, Excel, ZIP</strong>.
              </p>
            </CardHeader>
            <CardContent className="space-y-3 p-0">
              <label className="flex min-h-[110px] cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border/80 bg-background/45 p-5 text-center transition-colors hover:border-primary">
                <Upload className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium text-foreground">
                  Tap to choose files from your device
                </span>
                <input
                  type="file"
                  multiple
                  aria-label="Import document or spreadsheet files"
                  accept=".txt,.md,.markdown,.html,.htm,.pdf,.docx,.rtf,.csv,.xlsx,.zip,.doc"
                  className="sr-only"
                  onChange={(e) => void handleImportDocuments(e)}
                />
              </label>
              {importStatus && <p className="text-xs font-medium text-primary">{importStatus}</p>}
              {importError && <p className="text-xs font-medium text-destructive">{importError}</p>}
            </CardContent>
          </Card>

          {/* Backup & Restore */}
          <Card className="gap-0 p-5">
            <CardHeader className="p-0 pb-3">
              <CardTitle className="flex items-center gap-2 font-display text-base font-semibold">
                <Archive className="h-4 w-4 text-primary" />
                Full Backup & Restore
              </CardTitle>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Save a complete JSON backup or a ZIP folder with Markdown notes and attached files.
              </p>
            </CardHeader>
            <CardContent className="space-y-4 p-0">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={exportBusy}
                  onClick={async () => {
                    setExportBusy(true);
                    await exportFullWorkspaceJson();
                    setExportBusy(false);
                    showToast('Saved JSON backup');
                  }}
                  className="min-h-[42px] gap-1.5 rounded-xl px-4 text-xs font-semibold"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download Backup (JSON)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={exportBusy}
                  onClick={async () => {
                    setExportBusy(true);
                    await exportFullWorkspaceZip();
                    setExportBusy(false);
                    showToast('Saved ZIP archive');
                  }}
                  className="min-h-[42px] gap-1.5 rounded-xl bg-background/50 px-4 text-xs font-medium"
                >
                  <Download className="h-3.5 w-3.5" />
                  Download ZIP
                </Button>
              </div>

              <div className="border-t border-border/60 pt-3">
                <Button
                  type="button"
                  variant="link"
                  onClick={() => backupInputRef.current?.click()}
                  className="min-h-[40px] gap-1.5 px-0 text-xs font-medium text-primary"
                >
                  <Upload className="h-3.5 w-3.5" />
                  Restore from a JSON backup file...
                </Button>
                <input
                  ref={backupInputRef}
                  type="file"
                  accept=".json"
                  aria-label="Load JSON backup"
                  className="sr-only"
                  onChange={(e) => void handleLoadBackupJson(e)}
                />

                {pendingBackup && (
                  <div className="mt-3 space-y-2.5 rounded-xl border border-border/70 bg-background/55 p-3.5 text-xs">
                    <div className="font-semibold text-foreground">
                      Backup includes {pendingBackup.notes.length} notes,{' '}
                      {pendingBackup.tasks.length} tasks
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          ['workspaces', 'Spaces & Folders'],
                          ['notes', 'Notes & History'],
                          ['tasks', 'Tasks & Inbox'],
                          ['collections', 'Lists & Tables'],
                          ['snippetsAndBookmarks', 'Links & Snippets'],
                        ] as const
                      ).map(([key, label]) => (
                        <label
                          key={key}
                          className="flex cursor-pointer items-center gap-2 text-foreground"
                        >
                          <input
                            type="checkbox"
                            checked={restoreScopes[key]}
                            onChange={(e) =>
                              setRestoreScopes((prev) => ({ ...prev, [key]: e.target.checked }))
                            }
                            className="h-4 w-4 accent-primary"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                      <Select
                        value={restoreScopes.mode}
                        onValueChange={(value) => {
                          if (value === 'merge' || value === 'replace') {
                            setRestoreScopes((prev) => ({ ...prev, mode: value }));
                          }
                        }}
                      >
                        <SelectTrigger
                          aria-label="Restore mode"
                          className="h-9 min-w-[175px] rounded-xl bg-card/70 px-2.5 text-xs"
                        >
                          <SelectValue>
                            {restoreScopes.mode === 'merge'
                              ? 'Merge with current data'
                              : 'Replace selected items'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="merge">Merge with current data</SelectItem>
                          <SelectItem value="replace">Replace selected items</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => void handleApplySelectiveRestore()}
                        className="min-h-[38px] rounded-xl px-4 text-xs font-semibold"
                      >
                        Restore Now
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Integrity Check */}
        <Card className="gap-0 p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
                <ShieldCheck className="h-4 w-4 text-primary" />
                Workspace Health Check
              </h2>
              <p className="text-xs text-muted-foreground">
                Verify folders, note links, attachments, and check for duplicate items.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleRunIntegrityCheck()}
                className="min-h-[42px] rounded-xl px-4 text-xs font-semibold"
              >
                Run Integrity Check
              </Button>
              {integrityReport &&
                (integrityReport.danglingFolders.length > 0 ||
                  integrityReport.danglingTaskNotes.length > 0 ||
                  integrityReport.danglingCollectionRows.length > 0) && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleAutoRepair()}
                    className="min-h-[42px] gap-1.5 rounded-xl border-primary px-3.5 text-xs font-medium text-primary"
                  >
                    <Wrench className="h-3.5 w-3.5" />
                    Repair Links
                  </Button>
                )}
            </div>
          </div>

          {integrityReport && (
            <div className="mt-4 rounded-xl border border-border/70 bg-background/45 p-4 text-xs">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>
                  Checked {new Date(integrityReport.checkedAt).toLocaleTimeString()} ·{' '}
                  <span className="font-mono tabular-nums">{integrityReport.totalIssues}</span>{' '}
                  issue(s) found
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-3 font-mono tabular-nums text-muted-foreground sm:grid-cols-4">
                <div>Missing links: {integrityReport.brokenLinks.length}</div>
                <div>Unlinked notes: {integrityReport.orphanNotes.length}</div>
                <div>Duplicates: {integrityReport.duplicateGroups.length}</div>
                <div>
                  Broken refs:{' '}
                  {integrityReport.danglingFolders.length +
                    integrityReport.danglingTaskNotes.length +
                    integrityReport.danglingCollectionRows.length}
                </div>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
