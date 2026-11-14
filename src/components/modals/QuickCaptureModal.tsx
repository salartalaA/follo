import { Paperclip, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { captureToInbox, createTask, storeAttachmentFile } from '../../db/actions';
import { getTodayIsoDate } from '../../lib/tasks';
import { useUIStore } from '../../store/useUIStore';

type SimpleCaptureMode = 'note' | 'task' | 'link_file';

export function QuickCaptureModal() {
  const { quickCaptureOpen, activeWorkspaceId, setQuickCaptureOpen, setActiveView, showToast } =
    useUIStore();

  const [mode, setMode] = useState<SimpleCaptureMode>('note');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [tagsRaw, setTagsRaw] = useState('');
  const [showExtras, setShowExtras] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() && !content.trim() && !url.trim() && !selectedFile) {
      setError('Write something, paste a link, or attach a file before saving.');
      return;
    }

    if (mode === 'task' && !selectedFile) {
      await createTask({
        workspaceId: activeWorkspaceId,
        title: title.trim() || content.trim().slice(0, 80) || 'New To-Do',
        description: title.trim() ? content.trim() : '',
        dueDate: getTodayIsoDate(),
        priority: 'medium',
      });
      setTitle('');
      setContent('');
      setTagsRaw('');
      setShowExtras(false);
      setError('');
      setQuickCaptureOpen(false);
      setActiveView('tasks');
      showToast('Added to Tasks');
      return;
    }

    let attachmentId: string | null = null;
    if (selectedFile) {
      const stored = await storeAttachmentFile(activeWorkspaceId, selectedFile);
      attachmentId = stored.id;
    }

    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean);

    const detectedLink = url.trim() || (/^https?:\/\//i.test(content.trim()) ? content.trim() : '');
    const kind = selectedFile
      ? selectedFile.type.startsWith('image/')
        ? 'image'
        : 'file'
      : detectedLink
        ? 'link'
        : 'idea';

    await captureToInbox({
      workspaceId: activeWorkspaceId,
      kind,
      title: title.trim() || selectedFile?.name || detectedLink || 'Quick Note',
      content,
      url: detectedLink || null,
      language: null,
      attachmentId,
      tags,
    });

    setTitle('');
    setContent('');
    setUrl('');
    setTagsRaw('');
    setSelectedFile(null);
    setShowExtras(false);
    setError('');
    setQuickCaptureOpen(false);
    setActiveView('inbox');
    showToast('Saved to Inbox');
  }

  return (
    <Dialog open={quickCaptureOpen} onOpenChange={setQuickCaptureOpen}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="font-display text-base font-semibold">Quick Add</DialogTitle>
          <DialogDescription className="text-xs">
            Save a thought, to-do, link, or photo in seconds.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-3.5">
          <Tabs
            value={mode}
            onValueChange={(value) => {
              if (value === 'note' || value === 'task' || value === 'link_file') {
                setMode(value);
              }
            }}
          >
            <TabsList className="grid h-10 w-full grid-cols-3 rounded-xl bg-muted/70 p-1">
              <TabsTrigger value="note" className="rounded-lg text-xs font-medium">
                Quick Note
              </TabsTrigger>
              <TabsTrigger value="task" className="rounded-lg text-xs font-medium">
                To-Do
              </TabsTrigger>
              <TabsTrigger value="link_file" className="rounded-lg text-xs font-medium">
                Link / File
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <Input
            id="qc-title"
            type="text"
            autoFocus
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setError('');
            }}
            placeholder={
              mode === 'task'
                ? 'What do you need to do?'
                : mode === 'link_file'
                  ? 'Title or label (optional)...'
                  : 'What’s on your mind?'
            }
            aria-label="Quick capture title"
            className="h-11 rounded-xl bg-background/50 px-3.5 text-sm"
          />

          {mode === 'link_file' && (
            <div className="space-y-3">
              <Input
                id="qc-url"
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  setError('');
                }}
                placeholder="Paste a web link (https://...)"
                aria-label="Web link"
                className="h-11 rounded-xl bg-background/50 px-3.5 text-sm"
              />
              <label
                htmlFor="qc-file"
                className="flex min-h-[46px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-background/40 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
              >
                <Paperclip className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">
                  {selectedFile ? selectedFile.name : 'Choose a photo, PDF, or file'}
                </span>
                <input
                  id="qc-file"
                  type="file"
                  className="sr-only"
                  onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
                />
              </label>
            </div>
          )}

          <Textarea
            id="qc-content"
            rows={3}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              setError('');
            }}
            placeholder="Add extra details (optional)..."
            aria-label="Details"
            className="rounded-xl bg-background/50 px-3.5 py-2.5 text-sm"
          />

          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => setShowExtras((prev) => !prev)}
            className="h-auto gap-1.5 px-1 text-xs font-medium text-muted-foreground"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {showExtras ? 'Hide tags' : 'Add tags (optional)'}
          </Button>

          {showExtras && (
            <Input
              id="qc-tags"
              type="text"
              value={tagsRaw}
              onChange={(e) => setTagsRaw(e.target.value)}
              placeholder="Tags separated by commas (e.g. home, travel)"
              aria-label="Tags"
              className="h-10 rounded-xl bg-background/50 px-3.5 text-xs"
            />
          )}

          {error && <p className="text-xs font-medium text-destructive">{error}</p>}

          <DialogFooter className="mt-2 bg-transparent p-0 sm:mx-0 sm:mb-0 sm:border-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => setQuickCaptureOpen(false)}
              className="min-h-[44px] rounded-xl px-4 text-xs"
            >
              Cancel
            </Button>
            <Button type="submit" className="min-h-[44px] rounded-xl px-5 text-xs font-semibold">
              {mode === 'task' ? 'Add To-Do' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
