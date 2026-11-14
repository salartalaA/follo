import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { openOrCreateDailyNote, toggleTaskComplete } from '../../db/actions';
import { db } from '../../db/database';
import { getTodayIsoDate } from '../../lib/tasks';
import { useUIStore } from '../../store/useUIStore';

export function CalendarDailyView() {
  const { activeWorkspaceId, setSelectedNoteId } = useUIStore();
  const todayIso = getTodayIsoDate();
  const [selectedDay, setSelectedDay] = useState(todayIso);
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const notes = useLiveQuery(() => db.notes.toArray(), [], []);
  const tasks = useLiveQuery(() => db.tasks.toArray(), [], []);

  const dailyNotesByDate = useMemo(() => {
    const map = new Map<string, string>();
    for (const n of notes) {
      if (n.isDailyNote && n.dailyDate && !n.isArchived) {
        map.set(n.dailyDate, n.id);
      }
    }
    return map;
  }, [notes]);

  const tasksByDate = useMemo(() => {
    const map = new Map<string, typeof tasks>();
    for (const t of tasks) {
      if (t.dueDate) {
        const list = map.get(t.dueDate) ?? [];
        list.push(t);
        map.set(t.dueDate, list);
      }
    }
    return map;
  }, [tasks]);

  const monthStart = new Date(cursor.year, cursor.month, 1);
  const firstWeekday = monthStart.getDay();
  const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
  const monthLabel = monthStart.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  const cells: Array<{ iso: string | null; dayNum: number | null }> = [];
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push({ iso: null, dayNum: null });
  }
  for (let d = 1; d <= daysInMonth; d += 1) {
    const iso = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ iso, dayNum: d });
  }

  function shiftMonth(delta: number) {
    const next = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: next.getFullYear(), month: next.getMonth() });
  }

  async function handleOpenDaily(iso: string) {
    const note = await openOrCreateDailyNote(activeWorkspaceId, iso);
    setSelectedNoteId(note.id);
  }

  const selectedDayTasks = tasksByDate.get(selectedDay) ?? [];
  const selectedDayHasNote = dailyNotesByDate.has(selectedDay);

  return (
    <div className="flex-1 overflow-y-auto px-4 pb-24 pt-5 sm:px-6 md:pb-10 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Calendar & Daily Notes
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Tap a day to view its tasks or open your daily journal note.
            </p>
          </div>

          <Button
            type="button"
            onClick={() => void handleOpenDaily(todayIso)}
            className="min-h-[42px] gap-1.5 rounded-xl px-4 text-xs font-semibold"
          >
            <CalendarDays className="h-4 w-4" />
            Open Today&apos;s Note
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          {/* Calendar Grid */}
          <Card className="gap-0 p-4 sm:p-5 lg:col-span-8">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-display text-base font-semibold text-foreground">{monthLabel}</h2>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => shiftMonth(-1)}
                  aria-label="Previous month"
                  className="min-h-[40px] min-w-[40px] rounded-xl bg-background/50"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const now = new Date();
                    setCursor({ year: now.getFullYear(), month: now.getMonth() });
                    setSelectedDay(todayIso);
                  }}
                  className="min-h-[40px] rounded-xl bg-background/50 px-3 text-xs font-medium"
                >
                  Today
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => shiftMonth(1)}
                  aria-label="Next month"
                  className="min-h-[40px] min-w-[40px] rounded-xl bg-background/50"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1.5 text-center text-xs font-medium text-muted-foreground">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                <div key={d} className="py-1">
                  {d}
                </div>
              ))}
            </div>

            <div className="mt-1 grid grid-cols-7 gap-1.5">
              {cells.map((cell, pos) => {
                const iso = cell.iso;
                if (!iso || cell.dayNum === null) {
                  return (
                    <div
                      key={`empty-slot-${cursor.year}-${cursor.month}-${pos.toString(36)}`}
                      className="h-14 rounded-xl bg-background/30 sm:h-20"
                    />
                  );
                }
                const isToday = iso === todayIso;
                const isSelected = iso === selectedDay;
                const hasDaily = dailyNotesByDate.has(iso);
                const dayTasks = tasksByDate.get(iso) ?? [];
                const openCount = dayTasks.filter((t) => !t.completed).length;

                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setSelectedDay(iso)}
                    onDoubleClick={() => void handleOpenDaily(iso)}
                    className={`flex h-14 flex-col items-center justify-between rounded-xl border p-1.5 text-left transition-colors sm:h-20 sm:items-start sm:p-2 ${
                      isSelected
                        ? 'border-primary bg-secondary/75'
                        : isToday
                          ? 'border-primary/50 bg-background/80'
                          : 'border-border/70 bg-background/45 hover:border-primary/50'
                    }`}
                  >
                    <span
                      className={`font-mono text-xs font-semibold tabular-nums ${
                        isToday || isSelected ? 'text-primary' : 'text-foreground'
                      }`}
                    >
                      {cell.dayNum}
                    </span>

                    <div className="flex w-full items-center justify-center gap-1 sm:flex-col sm:items-start sm:gap-0.5">
                      {hasDaily && (
                        <span className="inline-flex items-center gap-1 text-[10px] text-primary">
                          <FileText className="h-3 w-3 shrink-0" />
                          <span className="hidden truncate sm:inline">Note</span>
                        </span>
                      )}
                      {openCount > 0 && (
                        <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                          <span className="sm:hidden">{openCount}t</span>
                          <span className="hidden sm:inline">
                            {openCount} task{openCount > 1 ? 's' : ''}
                          </span>
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Selected Day Agenda */}
          <Card className="gap-0 p-4 sm:p-5 lg:col-span-4">
            <aside aria-label="Selected day agenda">
              <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
                <div>
                  <h2 className="font-display text-base font-semibold text-foreground">
                    {selectedDay}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {selectedDay === todayIso ? 'Today' : 'Selected day'}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleOpenDaily(selectedDay)}
                  className="min-h-[38px] rounded-xl px-3 text-xs font-semibold"
                >
                  {selectedDayHasNote ? 'Open Note' : 'Create Note'}
                </Button>
              </div>

              <div className="mt-3 space-y-2">
                <div className="text-xs font-semibold text-muted-foreground">
                  Tasks ({selectedDayTasks.length})
                </div>
                {selectedDayTasks.length === 0 ? (
                  <p className="py-4 text-xs text-muted-foreground">
                    No tasks scheduled for this date.
                  </p>
                ) : (
                  <div className="divide-y divide-border/60 rounded-xl border border-border/70 bg-background/45">
                    {selectedDayTasks.map((task) => (
                      <button
                        key={task.id}
                        type="button"
                        onClick={() => void toggleTaskComplete(task.id)}
                        className="flex min-h-[44px] w-full items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-muted/50"
                      >
                        <CheckCircle2
                          className={`h-4 w-4 shrink-0 ${
                            task.completed ? 'text-primary' : 'text-muted-foreground'
                          }`}
                        />
                        <span
                          className={`truncate ${
                            task.completed
                              ? 'text-muted-foreground line-through'
                              : 'text-foreground'
                          }`}
                        >
                          {task.title}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </Card>
        </div>
      </div>
    </div>
  );
}
