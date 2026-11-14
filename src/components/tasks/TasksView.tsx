import { useLiveQuery } from 'dexie-react-hooks';
import { Bell, CheckCircle2, Circle, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { addSubtask, createTask, toggleSubtask, toggleTaskComplete } from '../../db/actions';
import { db } from '../../db/database';
import {
  filterTasksByBucket,
  getSubtaskProgress,
  getTaskCounts,
  getTodayIsoDate,
  type TaskBucket,
} from '../../lib/tasks';
import { useUIStore } from '../../store/useUIStore';
import type { TaskPriority } from '../../types/workspace';

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

function isTaskBucket(value: string): value is TaskBucket {
  return (
    value === 'today' ||
    value === 'upcoming' ||
    value === 'overdue' ||
    value === 'completed' ||
    value === 'all'
  );
}

function isTaskPriority(value: string): value is TaskPriority {
  return value === 'urgent' || value === 'high' || value === 'medium' || value === 'low';
}

export function TasksView() {
  const { activeWorkspaceId, setSelectedNoteId, showToast } = useUIStore();
  const [bucket, setBucket] = useState<TaskBucket>('today');
  const [scopeAll, setScopeAll] = useState(false);

  const [title, setTitle] = useState('');
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState(getTodayIsoDate());
  const [reminderLocal, setReminderLocal] = useState('');
  const [subtaskDrafts, setSubtaskDrafts] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  const allTasks = useLiveQuery(() => db.tasks.toArray(), [], []);
  const allNotes = useLiveQuery(() => db.notes.toArray(), [], []);
  const todayIso = getTodayIsoDate();

  const scopedTasks = useMemo(
    () => (scopeAll ? allTasks : allTasks.filter((t) => t.workspaceId === activeWorkspaceId)),
    [allTasks, scopeAll, activeWorkspaceId],
  );

  const counts = useMemo(() => getTaskCounts(scopedTasks, todayIso), [scopedTasks, todayIso]);
  const visibleTasks = useMemo(
    () => filterTasksByBucket(scopedTasks, bucket, todayIso),
    [scopedTasks, bucket, todayIso],
  );

  const noteTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of allNotes) {
      map.set(n.id, n.title);
    }
    return map;
  }, [allNotes]);

  async function handleCreateTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setFormError('Please enter a task title.');
      return;
    }
    const reminderAt = reminderLocal ? new Date(reminderLocal).getTime() : null;
    await createTask({
      workspaceId: activeWorkspaceId,
      title: title.trim(),
      priority,
      dueDate: dueDate || null,
      reminderAt: reminderAt && !Number.isNaN(reminderAt) ? reminderAt : null,
    });
    setTitle('');
    setReminderLocal('');
    setFormError('');
    setOptionsOpen(false);
    showToast('Task added');
  }

  const bucketTabs: Array<{ id: TaskBucket; label: string }> = [
    { id: 'today', label: 'Today' },
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'overdue', label: 'Overdue' },
    { id: 'completed', label: 'Done' },
    { id: 'all', label: 'All' },
  ];

  const priorityColor: Record<TaskPriority, string> = {
    urgent: 'text-destructive font-semibold',
    high: 'text-primary font-semibold',
    medium: 'text-foreground',
    low: 'text-muted-foreground',
  };

  const hasCustomOptions = priority !== 'medium' || Boolean(reminderLocal) || dueDate !== todayIso;

  return (
    <div className="flex-1 overflow-y-auto px-3.5 pt-4 content-pb-mobile sm:px-6 sm:pt-5 md:pb-10 lg:px-8">
      <div className="mx-auto max-w-4xl space-y-4 sm:space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Tasks
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Keep track of what matters today.</p>
          </div>
          <label className="flex min-h-[40px] cursor-pointer items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={scopeAll}
              onChange={(e) => setScopeAll(e.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            All spaces
          </label>
        </div>

        {/* Mobile-Friendly Task Creator */}
        <Card className="gap-0 p-3 sm:p-4">
          <form onSubmit={(e) => void handleCreateTask(e)}>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setFormError('');
                }}
                placeholder="What do you need to do?"
                aria-label="New task title"
                className="h-11 min-w-0 flex-1 rounded-xl bg-background/50 px-3.5 text-sm"
              />

              <Popover open={optionsOpen} onOpenChange={setOptionsOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant={optionsOpen || hasCustomOptions ? 'secondary' : 'outline'}
                      size="icon-lg"
                      aria-label="Task date and priority options"
                      className="min-h-[44px] min-w-[44px] shrink-0 rounded-xl"
                    />
                  }
                >
                  <SlidersHorizontal
                    className={`h-4 w-4 ${hasCustomOptions ? 'text-primary' : ''}`}
                  />
                </PopoverTrigger>
                <PopoverContent align="end" className="w-72 space-y-3 p-3.5">
                  <PopoverHeader>
                    <PopoverTitle className="font-display text-xs font-semibold">
                      Schedule & Priority
                    </PopoverTitle>
                  </PopoverHeader>

                  <div className="space-y-2.5">
                    <div className="space-y-1">
                      <span className="text-xs text-muted-foreground">Priority</span>
                      <Select
                        value={priority}
                        onValueChange={(value) => {
                          if (value && isTaskPriority(value)) setPriority(value);
                        }}
                      >
                        <SelectTrigger
                          aria-label="Task priority"
                          className="h-10 w-full rounded-xl bg-background/60 px-3 text-xs font-medium"
                        >
                          <SelectValue>{PRIORITY_LABELS[priority]}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="urgent">Urgent</SelectItem>
                          <SelectItem value="high">High</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="low">Low</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <label
                      htmlFor="task-due-date"
                      className="block space-y-1 text-xs text-muted-foreground"
                    >
                      <span>Due Date</span>
                      <Input
                        id="task-due-date"
                        type="date"
                        aria-label="Task due date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        className="h-10 rounded-xl bg-background/60 px-2.5 font-mono text-xs"
                      />
                    </label>

                    <label
                      htmlFor="task-reminder-at"
                      className="block space-y-1 text-xs text-muted-foreground"
                    >
                      <span>Reminder</span>
                      <Input
                        id="task-reminder-at"
                        type="datetime-local"
                        aria-label="Task reminder time"
                        value={reminderLocal}
                        onChange={(e) => setReminderLocal(e.target.value)}
                        className="h-10 rounded-xl bg-background/60 px-2.5 font-mono text-xs"
                      />
                    </label>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="xs"
                      onClick={() => {
                        setPriority('medium');
                        setDueDate(todayIso);
                        setReminderLocal('');
                      }}
                      className="text-muted-foreground"
                    >
                      Reset
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      onClick={() => setOptionsOpen(false)}
                      className="rounded-lg px-3"
                    >
                      Done
                    </Button>
                  </div>
                </PopoverContent>
              </Popover>

              <Button
                type="submit"
                className="min-h-[44px] shrink-0 gap-1.5 rounded-xl px-4 text-xs font-semibold"
              >
                <Plus className="h-4 w-4" />
                Add
              </Button>
            </div>

            {formError && <p className="mt-2 text-xs font-medium text-destructive">{formError}</p>}
          </form>
        </Card>

        {/* Scrollable Bucket Tabs */}
        <Tabs
          value={bucket}
          onValueChange={(value) => {
            if (isTaskBucket(value)) setBucket(value);
          }}
        >
          <div className="no-scrollbar overflow-x-auto pb-0.5">
            <TabsList className="h-11 w-max min-w-full justify-start gap-1 rounded-2xl bg-muted/65 p-1 backdrop-blur-md">
              {bucketTabs.map((t) => (
                <TabsTrigger
                  key={t.id}
                  value={t.id}
                  className="min-h-[36px] shrink-0 gap-1 rounded-xl px-2.5 text-xs font-medium whitespace-nowrap sm:px-3.5"
                >
                  <span>{t.label}</span>
                  <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
                    {counts[t.id]}
                  </span>
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>

        {/* Tasks List */}
        {visibleTasks.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground sm:p-10">
            No tasks in <span className="font-medium capitalize text-foreground">{bucket}</span>.
          </Card>
        ) : (
          <Card className="gap-0 py-0">
            <CardContent className="divide-y divide-border/60 p-0">
              {visibleTasks.map((task) => {
                const progress = getSubtaskProgress(task);
                const linkedTitle = task.linkedNoteId ? noteTitleMap.get(task.linkedNoteId) : null;
                return (
                  <div key={task.id} className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                      <div className="flex min-w-0 flex-1 items-start gap-1.5 sm:gap-2">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-lg"
                          onClick={() => void toggleTaskComplete(task.id)}
                          aria-label={`Mark task "${task.title}" ${task.completed ? 'incomplete' : 'complete'}`}
                          className="min-h-[44px] min-w-[44px] shrink-0 rounded-xl text-muted-foreground hover:text-primary active:scale-90 transition-transform"
                        >
                          {task.completed ? (
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          ) : (
                            <Circle className="h-5 w-5" />
                          )}
                        </Button>

                        <div className="min-w-0 flex-1 pt-2">
                          <div
                            className={`break-words text-sm font-medium ${
                              task.completed
                                ? 'text-muted-foreground line-through'
                                : 'text-foreground'
                            }`}
                          >
                            {task.title}
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className={`capitalize ${priorityColor[task.priority]}`}>
                              {task.priority}
                            </span>
                            {task.dueDate && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">Due {task.dueDate}</span>
                              </>
                            )}
                            {task.reminderAt && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="inline-flex items-center gap-1 font-mono tabular-nums">
                                  <Bell className="h-3 w-3 text-primary" />
                                  {new Date(task.reminderAt).toLocaleString()}
                                </span>
                              </>
                            )}
                            {progress.total > 0 && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono tabular-nums">
                                  {progress.done}/{progress.total} steps
                                </span>
                              </>
                            )}
                            {linkedTitle && task.linkedNoteId && (
                              <>
                                <span aria-hidden="true">·</span>
                                <Button
                                  type="button"
                                  variant="link"
                                  size="xs"
                                  onClick={() => setSelectedNoteId(task.linkedNoteId)}
                                  className="h-auto px-0 text-xs text-primary"
                                >
                                  {linkedTitle}
                                </Button>
                              </>
                            )}
                          </div>

                          {/* Subtasks */}
                          <div className="mt-2.5 space-y-1.5">
                            {task.subtasks.map((sub) => (
                              <label
                                key={sub.id}
                                className="flex min-h-[32px] cursor-pointer items-center gap-2.5 text-xs"
                              >
                                <input
                                  type="checkbox"
                                  checked={sub.completed}
                                  onChange={() => void toggleSubtask(task.id, sub.id)}
                                  className="h-4 w-4 accent-primary"
                                />
                                <span
                                  className={
                                    sub.completed
                                      ? 'text-muted-foreground line-through'
                                      : 'text-foreground'
                                  }
                                >
                                  {sub.title}
                                </span>
                              </label>
                            ))}

                            <form
                              onSubmit={async (e) => {
                                e.preventDefault();
                                const draft = subtaskDrafts[task.id] ?? '';
                                if (!draft.trim()) return;
                                await addSubtask(task.id, draft);
                                setSubtaskDrafts((prev) => ({ ...prev, [task.id]: '' }));
                              }}
                              className="flex items-center gap-1.5 pt-1"
                            >
                              <input
                                type="text"
                                value={subtaskDrafts[task.id] ?? ''}
                                onChange={(e) =>
                                  setSubtaskDrafts((prev) => ({
                                    ...prev,
                                    [task.id]: e.target.value,
                                  }))
                                }
                                placeholder="+ Add a step..."
                                aria-label={`Add subtask to ${task.title}`}
                                className="min-h-[36px] w-full max-w-xs bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground/70"
                              />
                            </form>
                          </div>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-lg"
                        onClick={() => {
                          void db.tasks.delete(task.id);
                          showToast('Deleted task');
                        }}
                        aria-label={`Delete task ${task.title}`}
                        className="min-h-[44px] min-w-[44px] shrink-0 rounded-xl text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
