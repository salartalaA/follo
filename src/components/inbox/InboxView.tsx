import { useLiveQuery } from 'dexie-react-hooks';
import {
  Bookmark,
  CheckSquare,
  Code2,
  FileText,
  Inbox as InboxIcon,
  Plus,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { captureToInbox, convertInboxItem } from '../../db/actions';
import { db } from '../../db/database';
import { useUIStore } from '../../store/useUIStore';
import type { InboxItemKind } from '../../types/workspace';

const KIND_LABELS: Record<InboxItemKind, string> = {
  idea: 'Idea',
  text: 'Note',
  link: 'Link',
  task: 'To-Do',
  code: 'Text Clip',
  image: 'Image',
  file: 'File',
};

function isInboxKind(value: string): value is InboxItemKind {
  return (
    value === 'idea' ||
    value === 'text' ||
    value === 'link' ||
    value === 'task' ||
    value === 'code' ||
    value === 'image' ||
    value === 'file'
  );
}

export function InboxView() {
  const { activeWorkspaceId, setSelectedNoteId, setActiveView, setQuickCaptureOpen, showToast } =
    useUIStore();

  const [quickTitle, setQuickTitle] = useState('');
  const [quickBody, setQuickBody] = useState('');
  const [quickKind, setQuickKind] = useState<InboxItemKind>('idea');
  const [showProcessed, setShowProcessed] = useState(false);
  const [kindFilter, setKindFilter] = useState<InboxItemKind | 'all'>('all');

  const items = useLiveQuery(() => db.inboxItems.orderBy('createdAt').reverse().toArray(), [], []);

  const visibleItems = items.filter((item) => {
    if (!showProcessed && item.processed) return false;
    if (showProcessed && !item.processed) return false;
    if (kindFilter !== 'all' && item.kind !== kindFilter) return false;
    return true;
  });

  async function handleInlineCapture(e: React.FormEvent) {
    e.preventDefault();
    if (!quickTitle.trim() && !quickBody.trim()) return;
    await captureToInbox({
      workspaceId: activeWorkspaceId,
      kind: quickKind,
      title: quickTitle.trim() || 'Quick Note',
      content: quickBody.trim(),
      url: quickKind === 'link' && quickBody.trim().startsWith('http') ? quickBody.trim() : null,
    });
    setQuickTitle('');
    setQuickBody('');
    showToast('Saved to Inbox');
  }

  async function handleConvert(itemId: string, target: 'note' | 'task' | 'bookmark' | 'snippet') {
    const { targetId } = await convertInboxItem(itemId, target);
    showToast(`Converted to ${target}`);
    if (target === 'note') {
      setSelectedNoteId(targetId);
    } else if (target === 'task') {
      setActiveView('tasks');
    } else {
      setActiveView('snippets');
    }
  }

  return (
    <div className="flex-1 overflow-y-auto px-3.5 pt-4 content-pb-mobile sm:px-6 sm:pt-5 md:pb-10 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4 sm:space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Quick Inbox
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              A holding spot for quick thoughts until you file them.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => setQuickCaptureOpen(true)}
            className="min-h-[42px] gap-1.5 rounded-xl px-4 text-xs font-semibold active:scale-95 transition-transform"
          >
            <Plus className="h-4 w-4" />
            Add Photo or File
          </Button>
        </div>

        {/* Inline Fast Capture */}
        <Card className="gap-0 p-3 sm:p-4">
          <form onSubmit={(e) => void handleInlineCapture(e)} className="space-y-2.5">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Input
                type="text"
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                placeholder="Write a quick thought, task, or link..."
                aria-label="Quick inbox title"
                className="h-11 min-w-0 flex-1 rounded-xl bg-background/50 px-3.5 text-sm"
              />
              <Button
                type="submit"
                className="min-h-[44px] shrink-0 rounded-xl px-4 text-xs font-semibold active:scale-95 transition-transform"
              >
                Save
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Select
                value={quickKind}
                onValueChange={(value) => {
                  if (value && isInboxKind(value)) setQuickKind(value);
                }}
              >
                <SelectTrigger
                  aria-label="Capture item kind"
                  className="h-9 w-full sm:w-auto sm:min-w-[116px] rounded-xl bg-background/50 px-3 text-xs font-medium"
                >
                  <SelectValue>{KIND_LABELS[quickKind]}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="idea">Idea</SelectItem>
                  <SelectItem value="text">Note</SelectItem>
                  <SelectItem value="link">Link</SelectItem>
                  <SelectItem value="task">To-Do</SelectItem>
                  <SelectItem value="code">Text Clip</SelectItem>
                </SelectContent>
              </Select>

              <Input
                type="text"
                value={quickBody}
                onChange={(e) => setQuickBody(e.target.value)}
                placeholder="Optional details or web address..."
                aria-label="Quick inbox details"
                className="h-9 min-w-0 flex-1 rounded-xl bg-background/50 px-3 text-xs"
              />
            </div>
          </form>
        </Card>

        {/* Filters */}
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <Tabs
            value={kindFilter}
            onValueChange={(value) => {
              if (value === 'all' || isInboxKind(value)) setKindFilter(value);
            }}
          >
            <div className="no-scrollbar overflow-x-auto pb-0.5">
              <TabsList className="h-10 w-max rounded-2xl bg-muted/65 p-1 backdrop-blur-md">
                {(['all', 'idea', 'text', 'link', 'task', 'file'] as const).map((k) => (
                  <TabsTrigger
                    key={k}
                    value={k}
                    className="min-h-[32px] shrink-0 rounded-xl px-3 text-xs font-medium capitalize"
                  >
                    {k}
                  </TabsTrigger>
                ))}
              </TabsList>
            </div>
          </Tabs>

          <Tabs
            value={showProcessed ? 'sorted' : 'tosort'}
            onValueChange={(value) => setShowProcessed(value === 'sorted')}
          >
            <TabsList className="h-10 rounded-2xl bg-muted/65 p-1 backdrop-blur-md">
              <TabsTrigger value="tosort" className="min-h-[32px] rounded-xl px-3 text-xs">
                To Sort
              </TabsTrigger>
              <TabsTrigger value="sorted" className="min-h-[32px] rounded-xl px-3 text-xs">
                Sorted
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Inbox List */}
        {visibleItems.length === 0 ? (
          <Card className="p-10 text-center">
            <InboxIcon className="mx-auto h-7 w-7 text-muted-foreground" />
            <h2 className="mt-3 font-display text-sm font-semibold text-foreground">
              {showProcessed ? 'No sorted items yet' : 'All caught up'}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Tap the + button anytime to save a quick idea, link, or reminder.
            </p>
          </Card>
        ) : (
          <Card className="gap-0 py-0">
            <CardContent className="divide-y divide-border/60 p-0">
              {visibleItems.map((item) => (
                <div key={item.id} className="p-4 transition-colors hover:bg-muted/30">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="font-medium capitalize text-primary">{item.kind}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono tabular-nums">
                            {new Date(item.createdAt).toLocaleDateString()}
                          </span>
                          {item.tags.length > 0 && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span>{item.tags.map((t) => `#${t}`).join(' ')}</span>
                            </>
                          )}
                        </div>
                        <h3 className="mt-1 font-display text-sm font-semibold text-foreground">
                          {item.title}
                        </h3>
                        {item.content && (
                          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-muted-foreground">
                            {item.content}
                          </p>
                        )}
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-1 inline-block text-xs text-primary underline"
                          >
                            {item.url}
                          </a>
                        )}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-lg"
                        onClick={() => {
                          void db.inboxItems.delete(item.id);
                          showToast('Removed inbox item');
                        }}
                        aria-label={`Delete inbox item ${item.title}`}
                        className="min-h-[40px] min-w-[40px] shrink-0 rounded-xl text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {!item.processed && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleConvert(item.id, 'note')}
                          className="min-h-[38px] flex-1 sm:flex-none justify-center gap-1.5 rounded-xl bg-background/50 px-3 text-xs active:scale-95 transition-transform"
                        >
                          <FileText className="h-3.5 w-3.5 text-primary" />
                          Move to Notes
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleConvert(item.id, 'task')}
                          className="min-h-[38px] flex-1 sm:flex-none justify-center gap-1.5 rounded-xl bg-background/50 px-3 text-xs active:scale-95 transition-transform"
                        >
                          <CheckSquare className="h-3.5 w-3.5 text-primary" />
                          Add to Tasks
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => void handleConvert(item.id, 'bookmark')}
                          className="min-h-[38px] flex-1 sm:flex-none justify-center gap-1.5 rounded-xl bg-background/50 px-3 text-xs active:scale-95 transition-transform"
                        >
                          <Bookmark className="h-3.5 w-3.5 text-primary" />
                          Save Link
                        </Button>
                        {item.kind === 'code' && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => void handleConvert(item.id, 'snippet')}
                            className="min-h-[38px] flex-1 sm:flex-none justify-center gap-1.5 rounded-xl bg-background/50 px-3 text-xs active:scale-95 transition-transform"
                          >
                            <Code2 className="h-3.5 w-3.5 text-primary" />
                            Save Clip
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
