import { CheckSquare, FileText, Home, LayoutGrid, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUIStore } from '../../store/useUIStore';

export function BottomNav() {
  const {
    activeView,
    moreSheetOpen,
    setActiveView,
    setQuickCaptureOpen,
    setMoreSheetOpen,
    setSelectedNoteId,
  } = useUIStore();

  const isMoreView = [
    'inbox',
    'calendar',
    'search',
    'graph',
    'collections',
    'pdf',
    'snippets',
    'vault',
  ].includes(activeView);

  return (
    <nav
      aria-label="Mobile navigation"
      className="glass-bar fixed bottom-0 left-0 right-0 z-40 border-t border-border/70 pb-safe md:hidden"
    >
      <div className="grid h-16 grid-cols-5 items-center px-1">
        <Button
          type="button"
          variant="ghost"
          onClick={() => setActiveView('home')}
          aria-current={activeView === 'home' ? 'page' : undefined}
          className={`flex h-12 min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 active:scale-95 transition-all ${
            activeView === 'home' ? 'text-primary font-semibold' : 'text-muted-foreground'
          }`}
        >
          <Home className="h-5 w-5" strokeWidth={activeView === 'home' ? 2.25 : 1.75} />
          <span className="text-[10px] leading-tight font-medium tracking-tight sm:text-[11px]">
            Home
          </span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            if (activeView === 'notes') {
              setSelectedNoteId(null);
            } else {
              setActiveView('notes');
            }
          }}
          aria-current={activeView === 'notes' ? 'page' : undefined}
          className={`flex h-12 min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 active:scale-95 transition-all ${
            activeView === 'notes' ? 'text-primary font-semibold' : 'text-muted-foreground'
          }`}
        >
          <FileText className="h-5 w-5" strokeWidth={activeView === 'notes' ? 2.25 : 1.75} />
          <span className="text-[10px] leading-tight font-medium tracking-tight sm:text-[11px]">
            Notes
          </span>
        </Button>

        <div className="flex items-center justify-center">
          <Button
            type="button"
            onClick={() => setQuickCaptureOpen(true)}
            aria-label="Quick capture"
            className="flex h-11 w-11 sm:w-12 items-center justify-center rounded-2xl shadow-sm active:scale-90 transition-transform"
          >
            <Plus className="h-5.5 w-5.5" strokeWidth={2.25} />
          </Button>
        </div>

        <Button
          type="button"
          variant="ghost"
          onClick={() => setActiveView('tasks')}
          aria-current={activeView === 'tasks' ? 'page' : undefined}
          className={`flex h-12 min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 active:scale-95 transition-all ${
            activeView === 'tasks' ? 'text-primary font-semibold' : 'text-muted-foreground'
          }`}
        >
          <CheckSquare className="h-5 w-5" strokeWidth={activeView === 'tasks' ? 2.25 : 1.75} />
          <span className="text-[10px] leading-tight font-medium tracking-tight sm:text-[11px]">
            Tasks
          </span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          onClick={() => setMoreSheetOpen(true)}
          aria-expanded={moreSheetOpen}
          className={`flex h-12 min-h-[44px] flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 active:scale-95 transition-all ${
            moreSheetOpen || isMoreView ? 'text-primary font-semibold' : 'text-muted-foreground'
          }`}
        >
          <LayoutGrid className="h-5 w-5" strokeWidth={moreSheetOpen || isMoreView ? 2.25 : 1.75} />
          <span className="text-[10px] leading-tight font-medium tracking-tight sm:text-[11px]">
            More
          </span>
        </Button>
      </div>
    </nav>
  );
}
