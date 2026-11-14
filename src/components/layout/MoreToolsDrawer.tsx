import { useLiveQuery } from 'dexie-react-hooks';
import {
  Bookmark,
  BookOpen,
  CalendarDays,
  ChevronRight,
  HardDrive,
  Inbox,
  Moon,
  Network,
  Search,
  Sparkles,
  Sun,
  Table2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { openOrCreateDailyNote } from '../../db/actions';
import { db } from '../../db/database';
import { getTodayIsoDate } from '../../lib/tasks';
import { useUIStore } from '../../store/useUIStore';
import type { WorkspaceView } from '../../types/workspace';
import { PWAInstallButton } from '../pwa/PWAInstallButton';

export function MoreToolsDrawer() {
  const {
    moreSheetOpen,
    activeWorkspaceId,
    activeView,
    theme,
    setMoreSheetOpen,
    setActiveWorkspaceId,
    setActiveView,
    setSelectedNoteId,
    toggleTheme,
    showToast,
  } = useUIStore();

  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : false,
  );

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => setIsDesktop(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const workspaces = useLiveQuery(() => db.workspaces.orderBy('createdAt').toArray(), [], []);
  const inboxCount = useLiveQuery(
    () => db.inboxItems.filter((item) => !item.processed).count(),
    [],
    0,
  );

  const everydayTools: Array<{
    id: WorkspaceView;
    title: string;
    subtitle: string;
    icon: typeof Inbox;
    badge?: number;
  }> = [
    {
      id: 'inbox',
      title: 'Quick Inbox',
      subtitle: 'Unsorted thoughts, links, and reminders',
      icon: Inbox,
      badge: inboxCount,
    },
    {
      id: 'calendar',
      title: 'Calendar & Journal',
      subtitle: 'Monthly plan and daily pages',
      icon: CalendarDays,
    },
    {
      id: 'snippets',
      title: 'Saved Links & Clips',
      subtitle: 'Bookmarks and text clips to keep',
      icon: Bookmark,
    },
    {
      id: 'pdf',
      title: 'Files & Photos',
      subtitle: 'Read PDFs and pull text from images',
      icon: BookOpen,
    },
  ];

  const organizeTools: Array<{
    id: WorkspaceView;
    title: string;
    icon: typeof Table2;
  }> = [
    { id: 'collections', title: 'Simple Tables', icon: Table2 },
    { id: 'search', title: 'Search Everything', icon: Search },
    { id: 'graph', title: 'Note Map', icon: Network },
    { id: 'vault', title: 'Backup & Export', icon: HardDrive },
  ];

  async function handleOpenTodayJournal() {
    const note = await openOrCreateDailyNote(activeWorkspaceId, getTodayIsoDate());
    setSelectedNoteId(note.id);
    setMoreSheetOpen(false);
  }

  return (
    <Sheet open={moreSheetOpen} onOpenChange={setMoreSheetOpen}>
      <SheetContent
        side={isDesktop ? 'right' : 'bottom'}
        className="max-h-[88vh] gap-0 p-0 md:h-full md:max-h-none md:w-96 md:max-w-96"
      >
        <div className="pt-2.5 md:hidden">
          <div className="mx-auto h-1.5 w-10 rounded-full bg-border" />
        </div>

        <SheetHeader className="border-b border-border/70 px-5 py-3.5">
          <SheetTitle className="font-display text-base font-semibold">More</SheetTitle>
          <SheetDescription className="text-xs">Spaces, tools, and settings</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {/* Compact Space Strip */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-medium text-muted-foreground">Space</h3>
              <Button
                type="button"
                variant="link"
                size="xs"
                onClick={() => void handleOpenTodayJournal()}
                className="h-auto gap-1 px-0 text-xs font-medium text-primary"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Open Today&apos;s Note
              </Button>
            </div>
            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-0.5">
              {workspaces.map((ws) => {
                const selected = ws.id === activeWorkspaceId;
                return (
                  <Button
                    key={ws.id}
                    type="button"
                    variant={selected ? 'secondary' : 'outline'}
                    size="sm"
                    onClick={() => {
                      setActiveWorkspaceId(ws.id);
                      showToast(`Switched to ${ws.name}`);
                    }}
                    className={`min-h-[40px] shrink-0 rounded-xl px-3.5 text-xs font-medium ${
                      selected ? 'border-primary/60' : 'bg-background/40'
                    }`}
                  >
                    {ws.name}
                  </Button>
                );
              })}
            </div>
          </section>

          <Separator className="bg-border/60" />

          {/* Everyday Features */}
          <section>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Everyday</h3>
            <Card className="gap-0 divide-y divide-border/60 py-0">
              {everydayTools.map((tool) => {
                const Icon = tool.icon;
                const active = activeView === tool.id;
                return (
                  <button
                    key={tool.id}
                    type="button"
                    onClick={() => setActiveView(tool.id)}
                    className={`flex min-h-[54px] w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors ${
                      active ? 'bg-secondary/70' : 'hover:bg-muted/50'
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/60 text-primary">
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-medium text-foreground">
                          {tool.title}
                        </span>
                        {typeof tool.badge === 'number' && tool.badge > 0 && (
                          <span className="font-mono text-xs font-semibold tabular-nums text-primary">
                            {tool.badge}
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">{tool.subtitle}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                );
              })}
            </Card>
          </section>

          {/* Organize & Backup */}
          <section>
            <h3 className="mb-2 text-xs font-medium text-muted-foreground">Organize & Backup</h3>
            <div className="grid grid-cols-2 gap-2">
              {organizeTools.map((tool) => {
                const Icon = tool.icon;
                const active = activeView === tool.id;
                return (
                  <Button
                    key={tool.id}
                    type="button"
                    variant={active ? 'secondary' : 'outline'}
                    onClick={() => setActiveView(tool.id)}
                    className={`min-h-[48px] justify-start gap-2.5 rounded-2xl px-3 text-left text-xs font-medium ${
                      active ? 'border-primary/60' : 'bg-background/40'
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0 text-primary" />
                    <span className="truncate">{tool.title}</span>
                  </Button>
                );
              })}
            </div>
          </section>
        </div>

        <SheetFooter className="flex-row items-center gap-2.5 border-t border-border/70 px-5 py-3.5 pb-safe">
          <Button
            type="button"
            variant="outline"
            onClick={toggleTheme}
            className="min-h-[44px] flex-1 gap-2 rounded-xl bg-background/50 text-xs font-medium"
          >
            {theme === 'light' ? (
              <>
                <Moon className="h-4 w-4 text-primary" />
                Dark Appearance
              </>
            ) : (
              <>
                <Sun className="h-4 w-4 text-primary" />
                Light Appearance
              </>
            )}
          </Button>
          <PWAInstallButton />
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
