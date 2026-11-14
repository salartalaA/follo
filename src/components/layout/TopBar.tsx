import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArrowLeft,
  BookOpenCheck,
  Maximize2,
  Minimize2,
  Moon,
  Plus,
  Search,
  SlidersHorizontal,
  Sun,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { db } from '../../db/database';
import { useUIStore } from '../../store/useUIStore';
import type { WorkspaceView } from '../../types/workspace';

const VIEW_LABELS: Record<WorkspaceView, string> = {
  home: 'Home',
  notes: 'Notes',
  inbox: 'Quick Inbox',
  tasks: 'Tasks',
  calendar: 'Calendar',
  search: 'Search',
  graph: 'Note Map',
  collections: 'Simple Tables',
  pdf: 'Files & Photos',
  snippets: 'Saved Links',
  vault: 'Backup & Export',
};

export function TopBar() {
  const {
    theme,
    activeWorkspaceId,
    activeView,
    selectedNoteId,
    inspectorOpen,
    focusMode,
    readingMode,
    toggleTheme,
    setActiveWorkspaceId,
    setActiveView,
    setSelectedNoteId,
    setInspectorOpen,
    toggleFocusMode,
    toggleReadingMode,
    setCommandPaletteOpen,
    setQuickCaptureOpen,
    setMoreSheetOpen,
  } = useUIStore();

  const workspaces = useLiveQuery(() => db.workspaces.orderBy('createdAt').toArray(), [], []);
  const activeNote = useLiveQuery(
    () => (selectedNoteId ? db.notes.get(selectedNoteId) : undefined),
    [selectedNoteId],
  );

  const activeWorkspace = workspaces.find((ws) => ws.id === activeWorkspaceId);
  const inMobileNoteDetail = activeView === 'notes' && Boolean(selectedNoteId);

  const desktopTabs: Array<{ id: WorkspaceView; label: string }> = [
    { id: 'home', label: 'Home' },
    { id: 'notes', label: 'Notes' },
    { id: 'tasks', label: 'Tasks' },
    { id: 'calendar', label: 'Calendar' },
    { id: 'search', label: 'Search' },
  ];

  return (
    <header className="glass-bar sticky top-0 z-30 flex min-h-[54px] shrink-0 items-center justify-between gap-2 border-b border-border/70 px-2.5 pt-safe sm:px-5 md:gap-8">
      {/* Left: Back / Brand + Space Switcher */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5 sm:gap-2">
        {inMobileNoteDetail && (
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            onClick={() => setSelectedNoteId(null)}
            aria-label="Back to notes list"
            className="min-h-[44px] min-w-[44px] shrink-0 rounded-xl md:hidden"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        )}

        <Button
          type="button"
          variant="ghost"
          onClick={() => setActiveView('home')}
          className={`h-9 items-center gap-1.5 rounded-xl px-1 text-left whitespace-nowrap shrink-0 hover:bg-transparent sm:gap-2 sm:px-1.5 ${
            inMobileNoteDetail ? 'hidden md:inline-flex' : 'inline-flex'
          }`}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground shadow-xs">
            F
          </span>
          <span className="font-display text-base font-semibold tracking-tight text-foreground">
            Folio
          </span>
        </Button>

        {inMobileNoteDetail ? (
          <span className="truncate text-sm font-semibold text-foreground md:hidden">
            {activeNote?.title || 'Untitled Note'}
          </span>
        ) : (
          <>
            {/* Space Selector - accessible on mobile and desktop */}
            <div className="flex min-w-0 items-center">
              <span aria-hidden="true" className="mx-1 text-muted-foreground/40 sm:mx-1.5">
                /
              </span>
              <Select
                value={activeWorkspaceId}
                onValueChange={(value) => {
                  if (value) setActiveWorkspaceId(value);
                }}
              >
                <SelectTrigger
                  size="sm"
                  aria-label="Active space"
                  className="h-7 max-w-[110px] rounded-lg border-border/70 bg-card/60 px-2 text-[11px] font-medium backdrop-blur-md sm:h-8 sm:max-w-[160px] sm:rounded-xl sm:px-2.5 sm:text-xs"
                >
                  <SelectValue>{activeWorkspace?.name || 'Personal'}</SelectValue>
                </SelectTrigger>
                <SelectContent align="start">
                  {workspaces.map((ws) => (
                    <SelectItem key={ws.id} value={ws.id}>
                      {ws.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {activeView !== 'home' && (
              <span className="hidden truncate text-xs font-medium text-muted-foreground sm:inline md:hidden">
                · {VIEW_LABELS[activeView]}
              </span>
            )}
          </>
        )}
      </div>

      {/* Center: Desktop Single-Line Navigation */}
      <nav aria-label="Primary navigation" className="hidden items-center gap-5 md:flex">
        {desktopTabs.map((tab) => {
          const isActive = activeView === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveView(tab.id)}
              className={`relative py-1.5 text-sm font-medium whitespace-nowrap shrink-0 transition-colors ${
                isActive ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute inset-x-0 -bottom-[11px] h-0.5 rounded-full bg-primary"
                />
              )}
            </button>
          );
        })}
        <button
          type="button"
          onClick={() => setMoreSheetOpen(true)}
          className="py-1.5 text-sm font-medium whitespace-nowrap shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        >
          More
        </button>
      </nav>

      {/* Right: Calm Contextual Actions */}
      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
        {activeView === 'notes' && selectedNoteId && (
          <>
            <Button
              type="button"
              variant={readingMode ? 'secondary' : 'ghost'}
              size="sm"
              onClick={toggleReadingMode}
              aria-pressed={readingMode}
              aria-label={readingMode ? 'Switch to edit mode' : 'Switch to reading mode'}
              title={readingMode ? 'Edit Note' : 'Reading Mode'}
              className="min-h-[44px] min-w-[44px] rounded-xl md:min-h-0 md:min-w-0 md:h-8 md:rounded-lg md:px-2.5"
            >
              <BookOpenCheck className="h-4 w-4" />
              <span className="hidden lg:inline">{readingMode ? 'Edit' : 'Read'}</span>
            </Button>

            <Button
              type="button"
              variant={inspectorOpen ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setInspectorOpen(!inspectorOpen)}
              aria-pressed={inspectorOpen}
              aria-label={inspectorOpen ? 'Hide note details' : 'Show note details'}
              title="Note Details"
              className="min-h-[44px] min-w-[44px] rounded-xl md:min-h-0 md:min-w-0 md:h-8 md:rounded-lg md:px-2.5"
            >
              <SlidersHorizontal className="h-4 w-4" />
              <span className="hidden lg:inline">Details</span>
            </Button>

            <Button
              type="button"
              variant={focusMode ? 'secondary' : 'ghost'}
              size="icon-sm"
              onClick={toggleFocusMode}
              aria-pressed={focusMode}
              aria-label={focusMode ? 'Exit focus mode' : 'Enter focus mode'}
              title="Focus Mode"
              className="hidden h-8 w-8 rounded-lg md:inline-flex"
            >
              {focusMode ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          </>
        )}

        {/* Mobile Search Icon (hidden inside open note so note header stays calm) */}
        {!inMobileNoteDetail && (
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            onClick={() => setActiveView('search')}
            aria-label="Search workspace"
            className="min-h-[44px] min-w-[44px] rounded-xl text-muted-foreground md:hidden"
          >
            <Search className="h-4.5 w-4.5" />
          </Button>
        )}

        {/* Desktop Quick Jump */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setCommandPaletteOpen(true)}
          aria-label="Search or run command"
          className="hidden h-8 items-center gap-2.5 rounded-xl border-border/70 bg-card/60 px-3 text-xs text-muted-foreground backdrop-blur-md md:inline-flex"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="hidden xl:inline">Search</span>
          <kbd className="rounded-md bg-muted/80 px-1.5 py-0.5 font-mono text-[10px] leading-none text-muted-foreground">
            ⌘K
          </kbd>
        </Button>

        {/* Theme Switch */}
        <Button
          type="button"
          variant="ghost"
          size="icon-lg"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          className={`${
            inMobileNoteDetail ? 'hidden md:inline-flex' : 'inline-flex'
          } min-h-[44px] min-w-[44px] rounded-xl text-muted-foreground md:min-h-0 md:min-w-0 md:h-8 md:w-8 md:rounded-lg`}
        >
          {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={() => setQuickCaptureOpen(true)}
          className="hidden h-8 items-center gap-1.5 rounded-xl px-3.5 text-xs font-semibold whitespace-nowrap md:inline-flex"
        >
          <Plus className="h-3.5 w-3.5" />
          Quick Add
        </Button>
      </div>
    </header>
  );
}
