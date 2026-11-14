import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowUpRight,
  Clock,
  Download,
  GitCompare,
  History,
  Link2,
  ListTree,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { createNote, restoreNoteVersion, saveNoteSnapshot } from '../../db/actions';
import { db } from '../../db/database';
import { computeLineDiff, computeWritingStats, extractOutlineFromHtml } from '../../lib/diff';
import { computeBacklinks, computeRelatedNotes, normalizeLinkKey } from '../../lib/links';
import type { ExportFormat } from '../../services/exportImport';
import { useUIStore } from '../../store/useUIStore';
import type { InspectorTab, Note } from '../../types/workspace';

interface InspectorDrawerProps {
  note: Note;
}

export function InspectorDrawer({ note }: InspectorDrawerProps) {
  const {
    inspectorOpen,
    inspectorTab,
    focusMode,
    setInspectorOpen,
    setInspectorTab,
    setSelectedNoteId,
    showToast,
  } = useUIStore();

  const [snapshotSummary, setSnapshotSummary] = useState('');
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const [exportBusy, setExportBusy] = useState<ExportFormat | null>(null);
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 1024 : false,
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const allNotes = useLiveQuery(() => db.notes.toArray(), [], []);
  const versions = useLiveQuery(
    () => db.noteVersions.where('noteId').equals(note.id).reverse().sortBy('createdAt'),
    [note.id],
    [],
  );

  const backlinks = useMemo(() => computeBacklinks(note, allNotes), [note, allNotes]);
  const relatedNotes = useMemo(() => computeRelatedNotes(note, allNotes), [note, allNotes]);
  const outline = useMemo(() => extractOutlineFromHtml(note.contentHtml), [note.contentHtml]);
  const stats = useMemo(() => computeWritingStats(note.contentText), [note.contentText]);

  const titleToNote = useMemo(() => {
    const map = new Map<string, Note>();
    for (const item of allNotes) {
      map.set(normalizeLinkKey(item.title), item);
    }
    return map;
  }, [allNotes]);

  const activeVersion = versions.find((v) => v.id === selectedVersionId) ?? versions[0] ?? null;
  const diffLines = useMemo(() => {
    if (!activeVersion) return [];
    return computeLineDiff(activeVersion.contentText, note.contentText);
  }, [activeVersion, note.contentText]);

  if (!inspectorOpen || focusMode) {
    return null;
  }

  async function handleSaveSnapshot(e: React.FormEvent) {
    e.preventDefault();
    await saveNoteSnapshot(note.id, snapshotSummary || 'Saved checkpoint');
    setSnapshotSummary('');
    showToast('Saved snapshot');
  }

  async function handleOpenOrCreateWikilink(targetTitle: string) {
    const existing = titleToNote.get(normalizeLinkKey(targetTitle));
    if (existing) {
      setSelectedNoteId(existing.id);
      return;
    }
    const created = await createNote({
      workspaceId: note.workspaceId,
      title: targetTitle,
      contentHtml: `<h1>${targetTitle}</h1><p>Linked from [[${note.title}]].</p>`,
    });
    setSelectedNoteId(created.id);
    showToast(`Created linked note "${targetTitle}"`);
  }

  async function handleExportNote(format: ExportFormat) {
    setExportBusy(format);
    try {
      const { exportNoteAsFormat } = await import('../../services/exportImport');
      await exportNoteAsFormat(note, format);
      showToast(`Exported ${format.toUpperCase()}`);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Export failed');
    } finally {
      setExportBusy(null);
    }
  }

  const tabs: Array<{ id: InspectorTab; label: string; icon: typeof Link2 }> = [
    { id: 'links', label: 'Links', icon: Link2 },
    { id: 'outline', label: 'Outline', icon: ListTree },
    { id: 'versions', label: 'History', icon: History },
    { id: 'stats', label: 'Export', icon: Clock },
  ];

  const drawerContent = (
    <div className="flex h-full flex-col">
      <div className="border-b border-border/60 p-2">
        <Tabs
          value={inspectorTab}
          onValueChange={(value) => {
            if (
              value === 'links' ||
              value === 'outline' ||
              value === 'versions' ||
              value === 'stats'
            ) {
              setInspectorTab(value);
            }
          }}
        >
          <TabsList className="grid h-9 w-full grid-cols-4 rounded-xl bg-muted/65 p-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="gap-1 rounded-lg px-1 py-1 text-[11px] sm:px-2 sm:text-xs"
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{tab.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto p-3.5 sm:p-4 pb-safe">
        {inspectorTab === 'links' && (
          <>
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground">
                Mentioned In ({backlinks.length})
              </h3>
              <div className="mt-2 space-y-2">
                {backlinks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No other notes link to [[{note.title || 'this note'}]] yet.
                  </p>
                ) : (
                  backlinks.map((bl) => (
                    <Card key={bl.sourceNoteId} className="gap-0 p-0 hover:ring-primary/50">
                      <button
                        type="button"
                        onClick={() => setSelectedNoteId(bl.sourceNoteId)}
                        className="block w-full p-3 text-left"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs font-medium text-foreground">
                          <span className="truncate">{bl.sourceTitle}</span>
                          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        </div>
                        <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                          {bl.excerpt}
                        </p>
                      </button>
                    </Card>
                  ))
                )}
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold text-muted-foreground">
                Linked Notes ({note.wikilinks.length})
              </h3>
              <div className="mt-2 space-y-1.5">
                {note.wikilinks.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Type <code className="font-mono">[[Note Title]]</code> in the note to connect
                    ideas.
                  </p>
                ) : (
                  note.wikilinks.map((target) => {
                    const exists = titleToNote.has(normalizeLinkKey(target));
                    return (
                      <Button
                        key={target}
                        type="button"
                        variant="outline"
                        onClick={() => void handleOpenOrCreateWikilink(target)}
                        className="min-h-[42px] w-full justify-between rounded-xl bg-background/40 px-3 text-left text-xs"
                      >
                        <span className="truncate font-medium text-foreground">[[{target}]]</span>
                        <span className="shrink-0 text-[11px] font-medium text-primary">
                          {exists ? 'Open' : 'Create'}
                        </span>
                      </Button>
                    );
                  })
                )}
              </div>
            </section>

            <section>
              <h3 className="text-xs font-semibold text-muted-foreground">
                Related Notes ({relatedNotes.length})
              </h3>
              <div className="mt-2 space-y-1.5">
                {relatedNotes.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Add tags or links to discover related notes.
                  </p>
                ) : (
                  relatedNotes.map((rel) => (
                    <Card key={rel.noteId} className="gap-0 p-0 hover:ring-primary/50">
                      <button
                        type="button"
                        onClick={() => setSelectedNoteId(rel.noteId)}
                        className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left"
                      >
                        <span className="truncate text-xs font-medium text-foreground">
                          {rel.title}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {rel.directLink ? 'Connected' : ''}
                          {rel.directLink && rel.sharedTags.length > 0 ? ' · ' : ''}
                          {rel.sharedTags.length > 0
                            ? `Shared: ${rel.sharedTags.map((t) => `#${t}`).join(', ')}`
                            : ''}
                        </span>
                      </button>
                    </Card>
                  ))
                )}
              </div>
            </section>
          </>
        )}

        {inspectorTab === 'outline' && (
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground">Document Outline</h3>
            <div className="mt-2 space-y-1">
              {outline.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Add headings to build a quick table of contents.
                </p>
              ) : (
                outline.map((h) => (
                  <div
                    key={h.id}
                    className={`rounded-lg px-2 py-1.5 text-xs text-foreground ${
                      h.level === 1
                        ? 'font-semibold'
                        : h.level === 2
                          ? 'pl-4 font-medium'
                          : 'pl-6 text-muted-foreground'
                    }`}
                  >
                    {h.text}
                  </div>
                ))
              )}
            </div>
          </section>
        )}

        {inspectorTab === 'versions' && (
          <div className="space-y-4">
            <form onSubmit={(e) => void handleSaveSnapshot(e)} className="space-y-2">
              <label
                htmlFor="snapshot-msg"
                className="block text-xs font-semibold text-muted-foreground"
              >
                Save Snapshot
              </label>
              <div className="flex gap-1.5">
                <Input
                  id="snapshot-msg"
                  type="text"
                  value={snapshotSummary}
                  onChange={(e) => setSnapshotSummary(e.target.value)}
                  placeholder="Optional checkpoint note..."
                  className="h-10 min-w-0 flex-1 rounded-xl bg-background/40 px-3 text-xs"
                />
                <Button
                  type="submit"
                  aria-label="Save version snapshot"
                  className="min-h-[40px] gap-1 rounded-xl px-3 text-xs font-semibold"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Save
                </Button>
              </div>
            </form>

            <div>
              <h3 className="text-xs font-semibold text-muted-foreground">
                Saved History ({versions.length})
              </h3>
              <div className="mt-2 space-y-2">
                {versions.map((ver) => {
                  const selected = activeVersion?.id === ver.id;
                  return (
                    <Card
                      key={ver.id}
                      className={`gap-0 p-3 ${selected ? 'ring-primary/60 bg-secondary/40' : ''}`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedVersionId(ver.id)}
                        className="w-full text-left"
                      >
                        <div className="text-xs font-medium text-foreground">{ver.summary}</div>
                        <div className="mt-0.5 font-mono text-[11px] tabular-nums text-muted-foreground">
                          {new Date(ver.createdAt).toLocaleString()}
                        </div>
                      </button>
                      <Button
                        type="button"
                        variant="link"
                        size="xs"
                        onClick={() => {
                          void restoreNoteVersion(note.id, ver.id);
                          showToast('Restored version');
                        }}
                        className="mt-2 h-auto justify-start gap-1 px-0 text-xs font-medium text-primary"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Restore this version
                      </Button>
                    </Card>
                  );
                })}
              </div>
            </div>

            {activeVersion && (
              <div>
                <h3 className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <GitCompare className="h-3.5 w-3.5" />
                  Changes vs Current
                </h3>
                <div className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-border/70 bg-background/50 p-2.5 font-mono text-[11px]">
                  {diffLines.map((line, lineOffset) => (
                    <div
                      key={`${line.type}-${line.text.slice(0, 24)}-${lineOffset.toString(36)}`}
                      className={`whitespace-pre-wrap px-1.5 py-0.5 ${
                        line.type === 'added'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                          : line.type === 'removed'
                            ? 'bg-destructive/15 text-destructive line-through'
                            : 'text-muted-foreground'
                      }`}
                    >
                      {line.type === 'added' ? '+ ' : line.type === 'removed' ? '- ' : '  '}
                      {line.text || ' '}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {inspectorTab === 'stats' && (
          <div className="space-y-5">
            <section>
              <h3 className="text-xs font-semibold text-muted-foreground">Note Summary</h3>
              <Card className="mt-2 gap-0 py-0">
                <dl className="divide-y divide-border/60 text-xs">
                  <div className="flex justify-between px-3 py-2.5">
                    <dt className="text-muted-foreground">Words</dt>
                    <dd className="font-mono font-semibold tabular-nums">{stats.words}</dd>
                  </div>
                  <div className="flex justify-between px-3 py-2.5">
                    <dt className="text-muted-foreground">Characters</dt>
                    <dd className="font-mono font-semibold tabular-nums">{stats.characters}</dd>
                  </div>
                  <div className="flex justify-between px-3 py-2.5">
                    <dt className="text-muted-foreground">Paragraphs</dt>
                    <dd className="font-mono font-semibold tabular-nums">{stats.paragraphs}</dd>
                  </div>
                  <div className="flex justify-between px-3 py-2.5">
                    <dt className="text-muted-foreground">Reading Time</dt>
                    <dd className="font-mono font-semibold tabular-nums">
                      {stats.readingMinutes} min
                    </dd>
                  </div>
                  <div className="flex justify-between px-3 py-2.5">
                    <dt className="text-muted-foreground">Last Updated</dt>
                    <dd className="font-mono tabular-nums">
                      {new Date(note.updatedAt).toLocaleDateString()}
                    </dd>
                  </div>
                </dl>
              </Card>
            </section>

            <section>
              <h3 className="text-xs font-semibold text-muted-foreground">Export Note</h3>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {(['md', 'txt', 'html', 'pdf', 'docx', 'rtf'] as const).map((fmt) => (
                  <Button
                    key={fmt}
                    type="button"
                    variant="outline"
                    disabled={exportBusy !== null}
                    onClick={() => void handleExportNote(fmt)}
                    className="min-h-[42px] gap-1.5 rounded-xl bg-background/40 text-xs font-medium"
                  >
                    <Download className="h-3.5 w-3.5 text-primary" />
                    {exportBusy === fmt ? '...' : fmt.toUpperCase()}
                  </Button>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );

  if (isDesktop) {
    return (
      <aside
        aria-label="Note details"
        className="glass-surface hidden w-80 shrink-0 border-l border-border/70 lg:flex lg:flex-col"
      >
        {drawerContent}
      </aside>
    );
  }

  return (
    <Sheet open={inspectorOpen} onOpenChange={setInspectorOpen}>
      <SheetContent side="bottom" className="max-h-[85dvh] gap-0 p-0">
        <div className="pt-2.5">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-border" />
        </div>
        <SheetHeader className="border-b border-border/60 px-4 py-2.5">
          <SheetTitle className="font-display text-sm font-semibold">
            Note Details & Tools
          </SheetTitle>
          <SheetDescription className="sr-only">
            Links, outline, history, and export
          </SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto">{drawerContent}</div>
      </SheetContent>
    </Sheet>
  );
}
