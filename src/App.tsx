import { useLiveQuery } from 'dexie-react-hooks';
import { Bell, X } from 'lucide-react';
import {
  Component,
  type ErrorInfo,
  lazy,
  type ReactNode,
  Suspense,
  useEffect,
  useState,
} from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Toaster } from '@/components/ui/sonner';
import { BottomNav } from './components/layout/BottomNav';
import { MoreToolsDrawer } from './components/layout/MoreToolsDrawer';
import { TopBar } from './components/layout/TopBar';
import { CommandPalette } from './components/modals/CommandPalette';
import { QuickCaptureModal } from './components/modals/QuickCaptureModal';
import { TemplatePickerModal } from './components/modals/TemplatePickerModal';
import { OfflineIndicator } from './components/pwa/OfflineIndicator';
import { toggleTaskComplete } from './db/actions';
import { db } from './db/database';
import { ensureDatabaseSeeded } from './db/seed';
import { getDueReminders } from './lib/tasks';
import { useUIStore } from './store/useUIStore';

const HomeDashboardView = lazy(() =>
  import('./components/home/HomeDashboardView').then((m) => ({
    default: m.HomeDashboardView,
  })),
);
const NotesWorkspaceView = lazy(() =>
  import('./components/editor/NotesWorkspaceView').then((m) => ({
    default: m.NotesWorkspaceView,
  })),
);
const InboxView = lazy(() =>
  import('./components/inbox/InboxView').then((m) => ({ default: m.InboxView })),
);
const TasksView = lazy(() =>
  import('./components/tasks/TasksView').then((m) => ({ default: m.TasksView })),
);
const CalendarDailyView = lazy(() =>
  import('./components/calendar/CalendarDailyView').then((m) => ({ default: m.CalendarDailyView })),
);
const SearchView = lazy(() =>
  import('./components/search/SearchView').then((m) => ({ default: m.SearchView })),
);
const KnowledgeGraphView = lazy(() =>
  import('./components/graph/KnowledgeGraphView').then((m) => ({ default: m.KnowledgeGraphView })),
);
const CollectionsView = lazy(() =>
  import('./components/collections/CollectionsView').then((m) => ({ default: m.CollectionsView })),
);
const PdfOcrView = lazy(() =>
  import('./components/pdf/PdfOcrView').then((m) => ({ default: m.PdfOcrView })),
);
const SnippetsBookmarksView = lazy(() =>
  import('./components/snippets/SnippetsBookmarksView').then((m) => ({
    default: m.SnippetsBookmarksView,
  })),
);
const VaultPortabilityView = lazy(() =>
  import('./components/vault/VaultPortabilityView').then((m) => ({
    default: m.VaultPortabilityView,
  })),
);

interface BoundaryState {
  hasError: boolean;
  message: string;
}

class ViewErrorBoundary extends Component<{ children: ReactNode }, BoundaryState> {
  override state: BoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { hasError: true, message: error.message };
  }

  override componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Error captured cleanly by boundary UI
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex flex-1 items-center justify-center p-6">
          <Card className="max-w-md border-destructive/40 text-center">
            <CardContent className="p-6">
              <h2 className="font-display text-base font-semibold">Something went wrong</h2>
              <p className="mt-1.5 text-xs text-muted-foreground">
                {this.state.message || 'An unexpected error occurred in this view.'}
              </p>
              <Button
                type="button"
                onClick={() => this.setState({ hasError: false, message: '' })}
                className="mt-4 min-h-10 rounded-xl px-4 text-xs font-semibold"
              >
                Try Again
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const {
    theme,
    activeView,
    focusMode,
    dismissedReminderIds,
    setCommandPaletteOpen,
    setQuickCaptureOpen,
    dismissReminder,
  } = useUIStore();

  const [ready, setReady] = useState(false);
  const [seedError, setSeedError] = useState('');
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const tasks = useLiveQuery(() => db.tasks.toArray(), [], []);
  const dueReminders = getDueReminders(tasks, Date.now()).filter(
    (t) => !dismissedReminderIds.includes(t.id),
  );

  useEffect(() => {
    let active = true;
    ensureDatabaseSeeded()
      .then(() => {
        if (active) setReady(true);
      })
      .catch((err: unknown) => {
        if (active) {
          setSeedError(
            err instanceof Error ? err.message : 'Failed to initialize local workspace storage.',
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.setAttribute('content', theme === 'dark' ? '#1c1c1a' : '#f9f7f2');
    }
  }, [theme]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(true);
      } else if (mod && e.shiftKey && e.key.toLowerCase() === 'i') {
        e.preventDefault();
        setQuickCaptureOpen(true);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setCommandPaletteOpen, setQuickCaptureOpen]);

  if (seedError) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 text-foreground">
        <Card className="max-w-md border-destructive/40">
          <CardContent className="p-6">
            <h1 className="font-display text-lg font-bold">Local Storage Error</h1>
            <p className="mt-2 text-sm text-muted-foreground">{seedError}</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Opening your local workspace...
      </main>
    );
  }

  return (
    <div className="flex h-dvh w-screen flex-col overflow-hidden text-foreground">
      <TopBar />

      {dueReminders.length > 0 && (
        <div className="glass-bar flex shrink-0 items-center justify-between gap-3 border-b border-border/70 px-4 py-1.5 text-xs text-foreground sm:px-5">
          <div className="flex min-w-0 items-center gap-2">
            <Bell className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">
              Reminder due: <strong>{dueReminders[0].title}</strong>
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => void toggleTaskComplete(dueReminders[0].id)}
              className="h-8 rounded-lg px-2.5 text-xs font-medium text-primary"
            >
              Done
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Dismiss reminder"
              onClick={() => dismissReminder(dueReminders[0].id)}
              className="h-8 w-8 rounded-lg text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}

      <main className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
        <ViewErrorBoundary>
          <Suspense
            fallback={
              <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
                Loading view...
              </div>
            }
          >
            {activeView === 'home' && (
              <HomeDashboardView onOpenTemplates={() => setTemplatesOpen(true)} />
            )}
            {activeView === 'notes' && (
              <NotesWorkspaceView onOpenTemplates={() => setTemplatesOpen(true)} />
            )}
            {activeView === 'inbox' && <InboxView />}
            {activeView === 'tasks' && <TasksView />}
            {activeView === 'calendar' && <CalendarDailyView />}
            {activeView === 'search' && <SearchView />}
            {activeView === 'graph' && <KnowledgeGraphView />}
            {activeView === 'collections' && <CollectionsView />}
            {activeView === 'pdf' && <PdfOcrView />}
            {activeView === 'snippets' && <SnippetsBookmarksView />}
            {activeView === 'vault' && <VaultPortabilityView />}
          </Suspense>
        </ViewErrorBoundary>
      </main>

      {!focusMode && <BottomNav />}
      <MoreToolsDrawer />
      <CommandPalette />
      <QuickCaptureModal />
      <TemplatePickerModal open={templatesOpen} onClose={() => setTemplatesOpen(false)} />
      <OfflineIndicator />
      <Toaster position="bottom-center" mobileOffset={{ bottom: 76 }} />
    </div>
  );
}
