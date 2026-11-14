import type { TaskItem, TaskPriority } from '../types/workspace';

export type TaskBucket = 'today' | 'upcoming' | 'overdue' | 'completed' | 'all';

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function getTodayIsoDate(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function classifyTaskBucket(task: TaskItem, todayIso: string): Exclude<TaskBucket, 'all'> {
  if (task.completed) {
    return 'completed';
  }
  if (!task.dueDate) {
    return 'upcoming';
  }
  if (task.dueDate < todayIso) {
    return 'overdue';
  }
  if (task.dueDate === todayIso) {
    return 'today';
  }
  return 'upcoming';
}

export function filterTasksByBucket(
  tasks: TaskItem[],
  bucket: TaskBucket,
  todayIso: string,
): TaskItem[] {
  const filtered =
    bucket === 'all'
      ? tasks
      : tasks.filter((task) => classifyTaskBucket(task, todayIso) === bucket);

  return [...filtered].sort((a, b) => {
    if (a.completed !== b.completed) {
      return a.completed ? 1 : -1;
    }
    const prioDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
    if (prioDiff !== 0) {
      return prioDiff;
    }
    if (a.dueDate && b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }
    if (a.dueDate) {
      return -1;
    }
    if (b.dueDate) {
      return 1;
    }
    return b.updatedAt - a.updatedAt;
  });
}

export function getTaskCounts(tasks: TaskItem[], todayIso: string): Record<TaskBucket, number> {
  const counts: Record<TaskBucket, number> = {
    today: 0,
    upcoming: 0,
    overdue: 0,
    completed: 0,
    all: tasks.length,
  };

  for (const task of tasks) {
    const bucket = classifyTaskBucket(task, todayIso);
    counts[bucket] += 1;
  }

  return counts;
}

export function getSubtaskProgress(task: TaskItem): { done: number; total: number } {
  const total = task.subtasks.length;
  const done = task.subtasks.filter((s) => s.completed).length;
  return { done, total };
}

export function getDueReminders(tasks: TaskItem[], nowMs: number): TaskItem[] {
  return tasks.filter((t) => !t.completed && t.reminderAt !== null && t.reminderAt <= nowMs);
}
