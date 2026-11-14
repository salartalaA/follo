import { useLiveQuery } from 'dexie-react-hooks';
import hljs from 'highlight.js';
import { Bookmark, Clipboard, Code2, Copy, ExternalLink, Plus, Trash2 } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import { uid } from '../../db/actions';
import { db } from '../../db/database';
import { useUIStore } from '../../store/useUIStore';

const SNIPPET_LANGUAGES: Array<{ value: string; label: string }> = [
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'css', label: 'CSS' },
  { value: 'json', label: 'JSON' },
];

export function SnippetsBookmarksView() {
  const { activeWorkspaceId, showToast } = useUIStore();
  const [tab, setTab] = useState<'bookmarks' | 'snippets' | 'clipboard'>('bookmarks');

  const [snipTitle, setSnipTitle] = useState('');
  const [snipLang, setSnipLang] = useState('typescript');
  const [snipCode, setSnipCode] = useState('');
  const [snipTags, setSnipTags] = useState('');

  const [bmTitle, setBmTitle] = useState('');
  const [bmUrl, setBmUrl] = useState('');
  const [bmDesc, setBmDesc] = useState('');
  const [bmTags, setBmTags] = useState('');

  const [clipboardError, setClipboardError] = useState('');

  const snippets = useLiveQuery(() => db.snippets.orderBy('updatedAt').reverse().toArray(), [], []);
  const bookmarks = useLiveQuery(
    () => db.bookmarks.orderBy('createdAt').reverse().toArray(),
    [],
    [],
  );
  const clipboardEntries = useLiveQuery(
    () => db.clipboardEntries.orderBy('createdAt').reverse().toArray(),
    [],
    [],
  );

  async function handleAddSnippet(e: React.FormEvent) {
    e.preventDefault();
    if (!snipTitle.trim() || !snipCode.trim()) return;
    const now = Date.now();
    await db.snippets.put({
      id: uid('snp'),
      workspaceId: activeWorkspaceId,
      title: snipTitle.trim(),
      language: snipLang,
      code: snipCode,
      description: '',
      tags: snipTags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      isFavorite: false,
      createdAt: now,
      updatedAt: now,
    });
    setSnipTitle('');
    setSnipCode('');
    setSnipTags('');
    showToast('Saved snippet');
  }

  async function handleAddBookmark(e: React.FormEvent) {
    e.preventDefault();
    if (!bmTitle.trim() || !bmUrl.trim()) return;
    await db.bookmarks.put({
      id: uid('bmk'),
      workspaceId: activeWorkspaceId,
      title: bmTitle.trim(),
      url: bmUrl.trim(),
      description: bmDesc.trim(),
      tags: bmTags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
      isFavorite: false,
      createdAt: Date.now(),
    });
    setBmTitle('');
    setBmUrl('');
    setBmDesc('');
    setBmTags('');
    showToast('Saved link');
  }

  async function handleCaptureClipboard() {
    setClipboardError('');
    if (!navigator.clipboard || typeof navigator.clipboard.readText !== 'function') {
      setClipboardError('Clipboard reading is not supported in this browser.');
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        setClipboardError('Your clipboard is empty.');
        return;
      }
      const kind = text.trim().startsWith('http')
        ? 'url'
        : text.includes('=>') || text.includes('{') || text.includes('function ')
          ? 'code'
          : 'text';
      await db.clipboardEntries.put({
        id: uid('clp'),
        content: text,
        kind,
        pinned: false,
        createdAt: Date.now(),
      });
      showToast('Saved from clipboard');
    } catch (err) {
      setClipboardError(
        err instanceof Error
          ? `Clipboard permission required (${err.message}).`
          : 'Clipboard permission denied.',
      );
    }
  }

  const activeLangLabel =
    SNIPPET_LANGUAGES.find((l) => l.value === snipLang)?.label ?? 'TypeScript';

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-24 pt-5 sm:px-6 md:pb-10 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Saved Links & Snippets
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Keep important web links, reusable text or code snippets, and clipboard clips offline.
            </p>
          </div>

          <Tabs
            value={tab}
            onValueChange={(value) => {
              if (value === 'bookmarks' || value === 'snippets' || value === 'clipboard') {
                setTab(value);
              }
            }}
          >
            <div className="no-scrollbar overflow-x-auto pb-0.5">
              <TabsList className="h-11 w-max rounded-2xl bg-muted/65 p-1 backdrop-blur-md">
                <TabsTrigger
                  value="bookmarks"
                  className="min-h-[36px] shrink-0 gap-1.5 rounded-xl px-3.5 text-xs"
                >
                  <Bookmark className="h-3.5 w-3.5" />
                  Links ({bookmarks.length})
                </TabsTrigger>
                <TabsTrigger
                  value="snippets"
                  className="min-h-[36px] shrink-0 gap-1.5 rounded-xl px-3.5 text-xs"
                >
                  <Code2 className="h-3.5 w-3.5" />
                  Snippets ({snippets.length})
                </TabsTrigger>
                <TabsTrigger
                  value="clipboard"
                  className="min-h-[36px] shrink-0 gap-1.5 rounded-xl px-3.5 text-xs"
                >
                  <Clipboard className="h-3.5 w-3.5" />
                  Clipboard ({clipboardEntries.length})
                </TabsTrigger>
              </TabsList>
            </div>
          </Tabs>
        </div>

        {tab === 'bookmarks' && (
          <div className="space-y-5">
            <Card className="gap-0 p-4">
              <form onSubmit={(e) => void handleAddBookmark(e)} className="space-y-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input
                    type="text"
                    value={bmTitle}
                    onChange={(e) => setBmTitle(e.target.value)}
                    placeholder="Link title..."
                    aria-label="Bookmark title"
                    className="h-10.5 rounded-xl bg-background/50 px-3.5 text-sm"
                  />
                  <Input
                    type="url"
                    value={bmUrl}
                    onChange={(e) => setBmUrl(e.target.value)}
                    placeholder="https://..."
                    aria-label="Bookmark URL"
                    className="h-10.5 rounded-xl bg-background/50 px-3.5 text-sm"
                  />
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input
                    type="text"
                    value={bmDesc}
                    onChange={(e) => setBmDesc(e.target.value)}
                    placeholder="Why you saved this..."
                    aria-label="Bookmark description"
                    className="h-10 rounded-xl bg-background/50 px-3.5 text-xs"
                  />
                  <Input
                    type="text"
                    value={bmTags}
                    onChange={(e) => setBmTags(e.target.value)}
                    placeholder="Tags (comma-separated)"
                    aria-label="Bookmark tags"
                    className="h-10 rounded-xl bg-background/50 px-3.5 text-xs"
                  />
                </div>
                <Button
                  type="submit"
                  className="min-h-[42px] gap-1.5 rounded-xl px-4 text-xs font-semibold"
                >
                  <Plus className="h-4 w-4" />
                  Save Link
                </Button>
              </form>
            </Card>

            <Card className="gap-0 py-0">
              <CardContent className="divide-y divide-border/60 p-0">
                {bookmarks.map((bm) => (
                  <div key={bm.id} className="flex items-start justify-between gap-3 p-4">
                    <div className="min-w-0">
                      <a
                        href={bm.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 font-display text-sm font-semibold text-foreground hover:text-primary"
                      >
                        {bm.title}
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-primary" />
                      </a>
                      <div className="truncate font-mono text-[11px] text-muted-foreground">
                        {bm.url}
                      </div>
                      {bm.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{bm.description}</p>
                      )}
                      {bm.tags.length > 0 && (
                        <div className="mt-1 text-xs text-primary">
                          {bm.tags.map((t) => `#${t}`).join(' ')}
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => void db.bookmarks.delete(bm.id)}
                      aria-label={`Delete bookmark ${bm.title}`}
                      className="min-h-[40px] min-w-[40px] shrink-0 rounded-xl text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {tab === 'snippets' && (
          <div className="space-y-5">
            <Card className="gap-0 p-4">
              <form onSubmit={(e) => void handleAddSnippet(e)} className="space-y-3">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <Input
                    type="text"
                    value={snipTitle}
                    onChange={(e) => setSnipTitle(e.target.value)}
                    placeholder="Snippet title..."
                    aria-label="Snippet title"
                    className="h-10.5 rounded-xl bg-background/50 px-3.5 text-sm"
                  />
                  <Select
                    value={snipLang}
                    onValueChange={(value) => {
                      if (value) setSnipLang(value);
                    }}
                  >
                    <SelectTrigger
                      aria-label="Snippet language"
                      className="h-10.5 w-full rounded-xl bg-background/50 px-3 text-xs"
                    >
                      <SelectValue>{activeLangLabel}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {SNIPPET_LANGUAGES.map((lang) => (
                        <SelectItem key={lang.value} value={lang.value}>
                          {lang.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="text"
                    value={snipTags}
                    onChange={(e) => setSnipTags(e.target.value)}
                    placeholder="Tags (comma-separated)"
                    aria-label="Snippet tags"
                    className="h-10.5 rounded-xl bg-background/50 px-3.5 text-xs"
                  />
                </div>
                <Textarea
                  rows={4}
                  value={snipCode}
                  onChange={(e) => setSnipCode(e.target.value)}
                  placeholder="Paste text or code..."
                  aria-label="Snippet code"
                  className="rounded-xl bg-background/50 p-3.5 font-mono text-xs"
                />
                <Button
                  type="submit"
                  className="min-h-[42px] gap-1.5 rounded-xl px-4 text-xs font-semibold"
                >
                  <Plus className="h-4 w-4" />
                  Save Snippet
                </Button>
              </form>
            </Card>

            <div className="space-y-4">
              {snippets.map((sn) => {
                const highlighted = hljs.getLanguage(sn.language)
                  ? hljs.highlight(sn.code, { language: sn.language }).value
                  : hljs.highlightAuto(sn.code).value;
                return (
                  <Card key={sn.id} className="gap-0 overflow-hidden py-0">
                    <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
                      <div className="min-w-0">
                        <span className="font-display text-sm font-semibold text-foreground">
                          {sn.title}
                        </span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {sn.language}{' '}
                          {sn.tags.length > 0 ? `· ${sn.tags.map((t) => `#${t}`).join(' ')}` : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            void navigator.clipboard.writeText(sn.code);
                            showToast('Copied snippet');
                          }}
                          aria-label={`Copy snippet ${sn.title}`}
                          className="min-h-[38px] min-w-[38px] rounded-xl bg-background/50"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => void db.snippets.delete(sn.id)}
                          aria-label={`Delete snippet ${sn.title}`}
                          className="min-h-[38px] min-w-[38px] rounded-xl text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <pre className="overflow-x-auto bg-[oklch(0.16_0.004_106.7)] p-4 font-mono text-xs text-[oklch(0.96_0.006_97.3)]">
                      <code dangerouslySetInnerHTML={{ __html: highlighted }} />
                    </pre>
                  </Card>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'clipboard' && (
          <div className="space-y-4">
            <Card className="gap-0 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-display text-sm font-semibold text-foreground">
                    Save from Clipboard
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Tap the button below to save whatever you just copied into local history.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={() => void handleCaptureClipboard()}
                  className="min-h-[42px] rounded-xl px-4 text-xs font-semibold"
                >
                  Paste & Save Clipboard
                </Button>
              </div>
              {clipboardError && (
                <p className="mt-2 text-xs font-medium text-primary">{clipboardError}</p>
              )}
            </Card>

            <Card className="gap-0 py-0">
              <CardContent className="divide-y divide-border/60 p-0">
                {clipboardEntries.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground">
                    No saved clipboard items yet.
                  </div>
                ) : (
                  clipboardEntries.map((entry) => (
                    <div key={entry.id} className="flex items-start justify-between gap-3 p-4">
                      <div className="min-w-0 flex-1">
                        <div className="text-[11px] text-muted-foreground">
                          <span className="font-medium capitalize">{entry.kind}</span> ·{' '}
                          <span className="font-mono tabular-nums">
                            {new Date(entry.createdAt).toLocaleString()}
                          </span>
                        </div>
                        <pre className="mt-1 whitespace-pre-wrap font-mono text-xs text-foreground">
                          {entry.content}
                        </pre>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => {
                            void navigator.clipboard.writeText(entry.content);
                            showToast('Copied');
                          }}
                          aria-label="Copy clipboard entry"
                          className="min-h-[40px] min-w-[40px] rounded-xl bg-background/50"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => void db.clipboardEntries.delete(entry.id)}
                          aria-label="Delete clipboard entry"
                          className="min-h-[40px] min-w-[40px] rounded-xl text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
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
