import { useLiveQuery } from 'dexie-react-hooks';
import {
  BookOpen,
  CalendarDays,
  CheckSquare,
  Code2,
  FileText,
  HardDrive,
  Home,
  Inbox,
  Network,
  Plus,
  Search,
  Table2,
  Zap,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { createNote, openOrCreateDailyNote } from '../../db/actions';
import { db } from '../../db/database';
import { searchWorkspaceEntities } from '../../lib/search';
import { getTodayIsoDate } from '../../lib/tasks';
import { useUIStore } from '../../store/useUIStore';

interface PaletteAction {
  id: string;
  label: string;
  group: 'Command' | 'Note' | 'Task' | 'Snippet' | 'Link' | 'File';
  subtitle: string;
  run: () => void | Promise<void>;
}

export function CommandPalette() {
  const {
    commandPaletteOpen,
    activeWorkspaceId,
    setCommandPaletteOpen,
    setActiveView,
    setSelectedNoteId,
    setSelectedAttachmentId,
    setQuickCaptureOpen,
    toggleTheme,
    toggleFocusMode,
  } = useUIStore();

  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const notes = useLiveQuery(() => db.notes.toArray(), [], []);
  const tasks = useLiveQuery(() => db.tasks.toArray(), [], []);
  const bookmarks = useLiveQuery(() => db.bookmarks.toArray(), [], []);
  const snippets = useLiveQuery(() => db.snippets.toArray(), [], []);
  const attachments = useLiveQuery(() => db.attachments.toArray(), [], []);

  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [commandPaletteOpen]);

  const actions = useMemo<PaletteAction[]>(() => {
    const q = query.trim().toLowerCase();
    const commands: PaletteAction[] = [
      {
        id: 'cmd-home',
        label: 'Go to Home Dashboard',
        group: 'Command',
        subtitle: 'Overview of today’s tasks, recent notes, and quick capture',
        run: () => {
          setActiveView('home');
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'cmd-capture',
        label: 'Quick Capture to Inbox',
        group: 'Command',
        subtitle: 'Save a thought, task, link, file, or snippet',
        run: () => {
          setCommandPaletteOpen(false);
          setQuickCaptureOpen(true);
        },
      },
      {
        id: 'cmd-new-note',
        label: 'Create New Note',
        group: 'Command',
        subtitle: 'Start writing in active space',
        run: async () => {
          const note = await createNote({ workspaceId: activeWorkspaceId, title: 'Untitled Note' });
          setSelectedNoteId(note.id);
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'cmd-daily',
        label: "Open Today's Daily Note",
        group: 'Command',
        subtitle: getTodayIsoDate(),
        run: async () => {
          const note = await openOrCreateDailyNote(activeWorkspaceId, getTodayIsoDate());
          setSelectedNoteId(note.id);
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'cmd-inbox',
        label: 'Go to Quick Inbox',
        group: 'Command',
        subtitle: 'Sort and convert captured items',
        run: () => {
          setActiveView('inbox');
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'cmd-tasks',
        label: 'Go to Tasks & Reminders',
        group: 'Command',
        subtitle: 'Today, Upcoming, Overdue, Completed',
        run: () => {
          setActiveView('tasks');
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'cmd-calendar',
        label: 'Go to Calendar & Daily Notes',
        group: 'Command',
        subtitle: 'Monthly schedule and daily journal entries',
        run: () => {
          setActiveView('calendar');
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'cmd-graph',
        label: 'Open Note Connections',
        group: 'Command',
        subtitle: 'Explore linked notes and activity timeline',
        run: () => {
          setActiveView('graph');
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'cmd-collections',
        label: 'Open Lists & Tables',
        group: 'Command',
        subtitle: 'Custom trackers and structured tables',
        run: () => {
          setActiveView('collections');
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'cmd-pdf',
        label: 'Open Files, PDFs & Scan Text',
        group: 'Command',
        subtitle: 'Read documents, highlight, and extract text locally',
        run: () => {
          setActiveView('pdf');
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'cmd-snippets',
        label: 'Open Saved Links & Snippets',
        group: 'Command',
        subtitle: 'Bookmarks, code snippets, and clipboard history',
        run: () => {
          setActiveView('snippets');
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'cmd-vault',
        label: 'Open Backup, Import & Export',
        group: 'Command',
        subtitle: 'Markdown, DOCX, PDF, XLSX, JSON, ZIP & vault check',
        run: () => {
          setActiveView('vault');
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'cmd-theme',
        label: 'Switch Light / Dark Appearance',
        group: 'Command',
        subtitle: 'Toggle workspace visual mode',
        run: () => {
          toggleTheme();
          setCommandPaletteOpen(false);
        },
      },
      {
        id: 'cmd-focus',
        label: 'Toggle Focus Mode',
        group: 'Command',
        subtitle: 'Hide navigation for distraction-free writing',
        run: () => {
          toggleFocusMode();
          setCommandPaletteOpen(false);
        },
      },
    ];

    const matchedCommands = q
      ? commands.filter(
          (c) => c.label.toLowerCase().includes(q) || c.subtitle.toLowerCase().includes(q),
        )
      : commands.slice(0, 7);

    const searchHits = searchWorkspaceEntities(
      { notes, tasks, bookmarks, snippets, attachments },
      {
        query: q,
        workspaceId: 'all',
        kind: 'all',
        tagFilter: '',
        includeArchived: false,
      },
    )
      .slice(0, 10)
      .map<PaletteAction>((hit) => {
        const groupMap = {
          note: 'Note',
          task: 'Task',
          bookmark: 'Link',
          snippet: 'Snippet',
          attachment: 'File',
        } as const;
        return {
          id: `hit-${hit.kind}-${hit.id}`,
          label: hit.title,
          group: groupMap[hit.kind],
          subtitle: hit.excerpt || hit.kind,
          run: () => {
            if (hit.kind === 'note') {
              setSelectedNoteId(hit.id);
            } else if (hit.kind === 'task') {
              setActiveView('tasks');
            } else if (hit.kind === 'attachment') {
              setSelectedAttachmentId(hit.id);
              setActiveView('pdf');
            } else {
              setActiveView('snippets');
            }
            setCommandPaletteOpen(false);
          },
        };
      });

    return [...matchedCommands, ...searchHits];
  }, [
    query,
    notes,
    tasks,
    bookmarks,
    snippets,
    attachments,
    activeWorkspaceId,
    setActiveView,
    setCommandPaletteOpen,
    setQuickCaptureOpen,
    setSelectedAttachmentId,
    setSelectedNoteId,
    toggleFocusMode,
    toggleTheme,
  ]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (actions.length > 0 ? (prev + 1) % actions.length : 0));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        actions.length > 0 ? (prev - 1 + actions.length) % actions.length : 0,
      );
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const target = actions[selectedIndex];
      if (target) {
        void target.run();
      }
    }
  }

  const groupIcon = (group: PaletteAction['group'], id: string) => {
    if (id === 'cmd-home') return <Home className="h-4 w-4" />;
    switch (group) {
      case 'Command':
        return <Zap className="h-4 w-4" />;
      case 'Note':
        return <FileText className="h-4 w-4" />;
      case 'Task':
        return <CheckSquare className="h-4 w-4" />;
      case 'Snippet':
        return <Code2 className="h-4 w-4" />;
      case 'Link':
        return <Inbox className="h-4 w-4" />;
      case 'File':
        return <BookOpen className="h-4 w-4" />;
      default:
        return <Plus className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={commandPaletteOpen} onOpenChange={setCommandPaletteOpen}>
      <DialogContent
        showCloseButton={false}
        onKeyDown={handleKeyDown}
        className="max-h-[85dvh] max-w-xl gap-0 overflow-hidden p-0 sm:max-h-[80vh]"
      >
        <DialogTitle className="sr-only">Quick Jump and Search</DialogTitle>

        <div className="flex items-center gap-2.5 border-b border-border/70 px-4 py-2.5">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <Input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="Jump to a note, task, link, file, or action..."
            aria-label="Quick jump search"
            className="h-10 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-2 sm:max-h-96">
          {actions.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No matching actions or saved items found.
            </div>
          ) : (
            actions.map((action, idx) => (
              <button
                key={action.id}
                type="button"
                onClick={() => void action.run()}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={`flex min-h-[52px] w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors ${
                  idx === selectedIndex
                    ? 'bg-secondary/80 text-foreground'
                    : 'text-foreground hover:bg-muted/60'
                }`}
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/70 bg-background/60 text-primary">
                    {groupIcon(action.group, action.id)}
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium">{action.label}</div>
                    <div className="truncate text-xs text-muted-foreground">{action.subtitle}</div>
                  </div>
                </div>
                <span className="shrink-0 text-xs font-medium text-muted-foreground">
                  {action.group}
                </span>
              </button>
            ))
          )}
        </div>

        <Separator className="hidden bg-border/70 sm:block" />
        <div className="hidden items-center justify-between px-4 py-2 text-xs text-muted-foreground sm:flex">
          <span className="flex items-center gap-3">
            <span>↑↓ Navigate</span>
            <span>↵ Open</span>
            <span>⌘⇧I Capture</span>
          </span>
          <span className="flex items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5" />
            <Network className="h-3.5 w-3.5" />
            <Table2 className="h-3.5 w-3.5" />
            <HardDrive className="h-3.5 w-3.5" />
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
