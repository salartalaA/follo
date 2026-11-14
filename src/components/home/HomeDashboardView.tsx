import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  Circle,
  FilePlus2,
  FileText,
  Inbox,
  Paperclip,
  Plus,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  captureToInbox,
  createNote,
  createTask,
  openOrCreateDailyNote,
  toggleTaskComplete,
} from '../../db/actions';
import { db } from '../../db/database';
import { filterTasksByBucket, getDueReminders, getTodayIsoDate } from '../../lib/tasks';
import { useUIStore } from '../../store/useUIStore';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

interface HomeDashboardViewProps {
  onOpenTemplates: () => void;
}

export function HomeDashboardView({ onOpenTemplates }: HomeDashboardViewProps) {
  const {
    activeWorkspaceId,
    setActiveWorkspaceId,
    setActiveView,
    setSelectedNoteId,
    setQuickCaptureOpen,
    showToast,
  } = useUIStore();

  const [quickInput, setQuickInput] = useState('');
  const [quickMode, setQuickMode] = useState<'idea' | 'task'>('idea');

  const workspaces = useLiveQuery(() => db.workspaces.orderBy('createdAt').toArray(), [], []);
  const notes = useLiveQuery(
    () => db.notes.where('workspaceId').equals(activeWorkspaceId).toArray(),
    [activeWorkspaceId],
    [],
  );
  const allTasks = useLiveQuery(() => db.tasks.toArray(), [], []);
  const inboxCount = useLiveQuery(
    () => db.inboxItems.filter((item) => !item.processed).count(),
    [],
    0,
  );

  const todayIso = getTodayIsoDate();
  const formattedToday = useMemo(
    () =>
      new Date().toLocaleDateString(undefined, {
        weekday: 'long',
        month: 'short',
        day: 'numeric',
      }),
    [],
  );

  const workspaceTasks = useMemo(
    () => allTasks.filter((t) => t.workspaceId === activeWorkspaceId),
    [allTasks, activeWorkspaceId],
  );
  const todayTasks = useMemo(
    () => filterTasksByBucket(workspaceTasks, 'today', todayIso),
    [workspaceTasks, todayIso],
  );
  const overdueTasks = useMemo(
    () => filterTasksByBucket(workspaceTasks, 'overdue', todayIso),
    [workspaceTasks, todayIso],
  );
  const dueReminders = useMemo(() => getDueReminders(allTasks, Date.now()), [allTasks]);

  const recentNotes = useMemo(
    () =>
      notes
        .filter((n) => !n.isArchived)
        .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.updatedAt - a.updatedAt)
        .slice(0, 4),
    [notes],
  );

  async function handleQuickSave(e: React.FormEvent) {
    e.preventDefault();
    const text = quickInput.trim();
    if (!text) return;

    if (quickMode === 'task') {
      await createTask({
        workspaceId: activeWorkspaceId,
        title: text,
        dueDate: todayIso,
        priority: 'medium',
      });
      showToast('Added to today’s tasks');
    } else if (/^https?:\/\//i.test(text)) {
      await captureToInbox({
        workspaceId: activeWorkspaceId,
        kind: 'link',
        title: text.replace(/^https?:\/\//i, '').slice(0, 48),
        content: text,
        url: text,
      });
      showToast('Saved link to Inbox');
    } else {
      await captureToInbox({
        workspaceId: activeWorkspaceId,
        kind: 'idea',
        title: text.slice(0, 64),
        content: text,
      });
      showToast('Saved to Inbox');
    }
    setQuickInput('');
  }

  async function handleCreateBlankNote() {
    const created = await createNote({
      workspaceId: activeWorkspaceId,
      title: 'Untitled Note',
    });
    setSelectedNoteId(created.id);
  }

  async function handleOpenTodayDailyNote() {
    const note = await openOrCreateDailyNote(activeWorkspaceId, todayIso);
    setSelectedNoteId(note.id);
  }

  const focusTasks = [...overdueTasks, ...todayTasks].slice(0, 4);

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-24 pt-5 sm:px-6 md:pb-10 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-5">
        {/* Friendly Greeting & Compact Space Strip */}
        <section className="space-y-3">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{formattedToday}</p>
            <h1 className="mt-0.5 font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              {getGreeting()}
            </h1>
          </div>

          <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {workspaces.map((ws) => {
              const active = ws.id === activeWorkspaceId;
              return (
                <Button
                  key={ws.id}
                  type="button"
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveWorkspaceId(ws.id)}
                  className={`min-h-[38px] shrink-0 rounded-xl px-3.5 text-xs ${
                    active ? 'font-semibold' : 'bg-card/55 text-muted-foreground backdrop-blur-md'
                  }`}
                >
                  {ws.name}
                </Button>
              );
            })}
          </div>
        </section>

        {/* Simple One-Tap Capture Card */}
        <Card className="gap-0 p-3.5 sm:p-4">
          <form onSubmit={(e) => void handleQuickSave(e)} className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={quickInput}
                onChange={(e) => setQuickInput(e.target.value)}
                placeholder={
                  quickMode === 'task'
                    ? 'Add a to-do for today...'
                    : 'Jot down a thought, note, or link...'
                }
                aria-label="Quick capture input"
                className="h-11 min-w-0 flex-1 rounded-xl bg-background/50 px-3.5 text-sm"
              />
              <Button
                type="submit"
                className="min-h-[44px] shrink-0 gap-1 rounded-xl px-4 text-xs font-semibold"
              >
                <Plus className="h-4 w-4" />
                Save
              </Button>
            </div>

            <div className="flex items-center justify-between gap-2">
              <Tabs
                value={quickMode}
                onValueChange={(value) => {
                  if (value === 'idea' || value === 'task') setQuickMode(value);
                }}
              >
                <TabsList className="h-9 rounded-xl bg-muted/65 p-1">
                  <TabsTrigger value="idea" className="rounded-lg px-3 text-xs font-medium">
                    Quick Note
                  </TabsTrigger>
                  <TabsTrigger value="task" className="rounded-lg px-3 text-xs font-medium">
                    To-Do
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setQuickCaptureOpen(true)}
                className="min-h-[36px] gap-1.5 rounded-xl px-2.5 text-xs text-muted-foreground"
              >
                <Paperclip className="h-3.5 w-3.5" />
                Photo or File
              </Button>
            </div>
          </form>
        </Card>

        {/* Today's To-Dos */}
        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row items-center justify-between border-b border-border/60 px-4 py-3">
            <CardTitle className="font-display text-base font-semibold">
              Today&apos;s To-Dos
            </CardTitle>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setActiveView('tasks')}
              className="min-h-[36px] gap-1 rounded-xl px-2.5 text-xs font-medium text-primary"
            >
              See all
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </CardHeader>

          {dueReminders.length > 0 && (
            <div className="flex items-center justify-between gap-3 border-b border-border/60 bg-secondary/45 px-4 py-2.5 text-xs">
              <div className="flex min-w-0 items-center gap-2 text-foreground">
                <Bell className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate">{dueReminders[0].title}</span>
              </div>
              <Button
                type="button"
                variant="link"
                size="xs"
                onClick={() => void toggleTaskComplete(dueReminders[0].id)}
                className="h-auto shrink-0 px-0 font-medium text-primary"
              >
                Done
              </Button>
            </div>
          )}

          <CardContent className="divide-y divide-border/60 p-0">
            {focusTasks.length === 0 ? (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-muted-foreground">Nothing left on your list today.</p>
              </div>
            ) : (
              focusTasks.map((task) => (
                <div key={task.id} className="flex min-h-[54px] items-center gap-1.5 px-2.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-lg"
                    onClick={() => void toggleTaskComplete(task.id)}
                    aria-label={`Mark "${task.title}" ${task.completed ? 'incomplete' : 'complete'}`}
                    className="min-h-[44px] min-w-[44px] shrink-0 rounded-xl text-muted-foreground hover:text-primary"
                  >
                    {task.completed ? (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </Button>
                  <button
                    type="button"
                    onClick={() => setActiveView('tasks')}
                    className="min-w-0 flex-1 py-2 pr-2 text-left"
                  >
                    <div className="truncate text-sm font-medium text-foreground">{task.title}</div>
                    {task.dueDate && task.dueDate < todayIso && (
                      <div className="text-xs text-destructive">Overdue · {task.dueDate}</div>
                    )}
                  </button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Recent Notes */}
        <Card className="gap-0 py-0">
          <CardHeader className="flex flex-row items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
            <CardTitle className="font-display text-base font-semibold">Recent Notes</CardTitle>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onOpenTemplates}
                className="min-h-[38px] rounded-xl px-2.5 text-xs text-muted-foreground"
              >
                Templates
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={() => void handleCreateBlankNote()}
                className="min-h-[38px] gap-1 rounded-xl px-3 text-xs font-semibold"
              >
                <FilePlus2 className="h-3.5 w-3.5" />
                New Note
              </Button>
            </div>
          </CardHeader>

          <CardContent className="divide-y divide-border/60 p-0">
            {recentNotes.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                No notes yet. Tap &ldquo;New Note&rdquo; to start writing.
              </div>
            ) : (
              recentNotes.map((note) => (
                <button
                  key={note.id}
                  type="button"
                  onClick={() => setSelectedNoteId(note.id)}
                  className="flex min-h-[58px] w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/40"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/50 text-primary">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-foreground">
                      {note.title || 'Untitled Note'}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {note.contentText.trim().slice(0, 72) ||
                        new Date(note.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* Two Simple Shortcuts: Today's Journal & Quick Inbox */}
        <section className="grid grid-cols-2 gap-3">
          <Card className="gap-0 p-0 transition-colors hover:ring-primary/50">
            <button
              type="button"
              onClick={() => void handleOpenTodayDailyNote()}
              className="flex min-h-[82px] w-full flex-col items-start justify-between p-3.5 text-left"
            >
              <CalendarDays className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-semibold text-foreground">Today&apos;s Journal</div>
                <div className="text-xs text-muted-foreground">Open daily page</div>
              </div>
            </button>
          </Card>

          <Card className="gap-0 p-0 transition-colors hover:ring-primary/50">
            <button
              type="button"
              onClick={() => setActiveView('inbox')}
              className="flex min-h-[82px] w-full flex-col items-start justify-between p-3.5 text-left"
            >
              <Inbox className="h-5 w-5 text-primary" />
              <div>
                <div className="text-sm font-semibold text-foreground">Quick Inbox</div>
                <div className="text-xs text-muted-foreground">
                  {inboxCount === 0 ? 'All sorted' : `${inboxCount} to sort`}
                </div>
              </div>
            </button>
          </Card>
        </section>
      </div>
    </div>
  );
}
