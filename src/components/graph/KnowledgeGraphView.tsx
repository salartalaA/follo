import { useLiveQuery } from 'dexie-react-hooks';
import { Clock, Network, ZoomIn, ZoomOut } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { db } from '../../db/database';
import { buildKnowledgeGraph, type GraphNode, stepForceLayout } from '../../lib/graph';
import { useUIStore } from '../../store/useUIStore';

export function KnowledgeGraphView() {
  const { activeWorkspaceId, theme, setSelectedNoteId } = useUIStore();
  const [tab, setTab] = useState<'graph' | 'timeline'>('graph');
  const [includeTags, setIncludeTags] = useState(true);
  const [scopeAll, setScopeAll] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [panTick, setPanTick] = useState(0);
  const [hoveredNode, setHoveredNode] = useState<GraphNode | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const nodesRef = useRef<GraphNode[]>([]);
  const panRef = useRef({ x: 0, y: 0 });
  const dragRef = useRef<{ dragging: boolean; startX: number; startY: number }>({
    dragging: false,
    startX: 0,
    startY: 0,
  });

  const notes = useLiveQuery(() => db.notes.toArray(), [], []);
  const events = useLiveQuery(
    () => db.activityEvents.orderBy('createdAt').reverse().limit(60).toArray(),
    [],
    [],
  );

  const graphData = useMemo(
    () =>
      buildKnowledgeGraph(notes, {
        includeTags,
        workspaceId: scopeAll ? 'all' : activeWorkspaceId,
      }),
    [notes, includeTags, scopeAll, activeWorkspaceId],
  );

  useEffect(() => {
    const clonedNodes = graphData.nodes.map((n) => ({ ...n }));
    for (let i = 0; i < 90; i += 1) {
      stepForceLayout(clonedNodes, graphData.edges);
    }
    nodesRef.current = clonedNodes;
  }, [graphData]);

  useEffect(() => {
    if (tab !== 'graph') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    let ticks = 0;

    const render = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const targetW = Math.max(300, Math.floor(rect.width * dpr));
      const targetH = Math.max(300, Math.floor(rect.height * dpr));
      if (canvas.width !== targetW || canvas.height !== targetH) {
        canvas.width = targetW;
        canvas.height = targetH;
      }

      if (ticks < 120) {
        stepForceLayout(nodesRef.current, graphData.edges);
        ticks += 1;
      }

      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, rect.width, rect.height);

      const cx = rect.width / 2 + panRef.current.x;
      const cy = rect.height / 2 + panRef.current.y;

      const byId = new Map<string, GraphNode>();
      for (const n of nodesRef.current) byId.set(n.id, n);

      const isDark = theme === 'dark';
      for (const edge of graphData.edges) {
        const src = byId.get(edge.source);
        const dst = byId.get(edge.target);
        if (!src || !dst) continue;
        ctx.beginPath();
        ctx.moveTo(cx + src.x * zoom, cy + src.y * zoom);
        ctx.lineTo(cx + dst.x * zoom, cy + dst.y * zoom);
        ctx.strokeStyle =
          edge.kind === 'wikilink'
            ? isDark
              ? 'rgba(216, 188, 126, 0.5)'
              : 'rgba(148, 118, 56, 0.45)'
            : isDark
              ? 'rgba(176, 168, 152, 0.22)'
              : 'rgba(110, 102, 86, 0.22)';
        ctx.lineWidth = edge.kind === 'wikilink' ? 1.5 : 1;
        ctx.stroke();
      }

      for (const node of nodesRef.current) {
        const sx = cx + node.x * zoom;
        const sy = cy + node.y * zoom;
        const radius = node.kind === 'note' ? Math.min(13, 6 + node.degree * 1.4) : 5;
        const isHovered = hoveredNode?.id === node.id;

        ctx.beginPath();
        ctx.arc(sx, sy, radius, 0, Math.PI * 2);
        if (node.kind === 'note') {
          ctx.fillStyle = isHovered
            ? isDark
              ? '#f4eedf'
              : '#3b3222'
            : isDark
              ? '#d4ba82'
              : '#9a7e44';
        } else {
          ctx.fillStyle = isDark ? '#9a9386' : '#857d6e';
        }
        ctx.fill();

        const displayLabel = node.label.length > 26 ? `${node.label.slice(0, 25)}…` : node.label;
        ctx.font = `${node.kind === 'note' ? '600 11px' : '500 10px'} "DM Sans", sans-serif`;
        ctx.fillStyle = isDark ? '#f4f2ec' : '#1f1e1b';
        ctx.textAlign = 'center';
        ctx.fillText(displayLabel, sx, sy + radius + 14);
      }

      ctx.restore();
      if (ticks < 120) {
        animId = window.requestAnimationFrame(render);
      }
    };

    animId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(animId);
  }, [tab, graphData, theme, zoom, panTick, hoveredNode]);

  function findNodeAt(clientX: number, clientY: number): GraphNode | null {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;
    const cx = rect.width / 2 + panRef.current.x;
    const cy = rect.height / 2 + panRef.current.y;

    for (const node of nodesRef.current) {
      const sx = cx + node.x * zoom;
      const sy = cy + node.y * zoom;
      const dist = Math.hypot(mx - sx, my - sy);
      if (dist <= 22) return node;
    }
    return null;
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden px-3.5 pt-4 content-pb-mobile sm:px-6 sm:pt-5 md:pb-8 lg:px-8">
      <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 overflow-hidden">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground">
              Note Connections
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              See how your notes and topics connect, or browse recent activity.
            </p>
          </div>

          <Tabs
            value={tab}
            onValueChange={(value) => {
              if (value === 'graph' || value === 'timeline') setTab(value);
            }}
          >
            <TabsList className="h-11 rounded-2xl bg-muted/65 p-1 backdrop-blur-md">
              <TabsTrigger value="graph" className="min-h-[36px] gap-1.5 rounded-xl px-3.5 text-xs">
                <Network className="h-3.5 w-3.5" />
                Map ({graphData.nodes.length})
              </TabsTrigger>
              <TabsTrigger
                value="timeline"
                className="min-h-[36px] gap-1.5 rounded-xl px-3.5 text-xs"
              >
                <Clock className="h-3.5 w-3.5" />
                Activity ({events.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {tab === 'graph' ? (
          <Card className="relative flex flex-1 flex-col gap-0 overflow-hidden py-0">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-2.5 text-xs">
              <div className="flex items-center gap-4">
                <label className="flex min-h-[34px] cursor-pointer items-center gap-1.5 text-foreground">
                  <input
                    type="checkbox"
                    checked={includeTags}
                    onChange={(e) => setIncludeTags(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  Show #tags
                </label>
                <label className="flex min-h-[34px] cursor-pointer items-center gap-1.5 text-foreground">
                  <input
                    type="checkbox"
                    checked={scopeAll}
                    onChange={(e) => setScopeAll(e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                  All spaces
                </label>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="font-mono tabular-nums text-muted-foreground">
                  {graphData.nodes.length} items · {graphData.edges.length} links
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Zoom out graph"
                  onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))))}
                  className="min-h-[36px] min-w-[36px] rounded-xl bg-background/50"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Zoom in graph"
                  onClick={() => setZoom((z) => Math.min(2, Number((z + 0.15).toFixed(2))))}
                  className="min-h-[36px] min-w-[36px] rounded-xl bg-background/50"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="relative min-h-[340px] flex-1">
              <canvas
                ref={canvasRef}
                data-testid="knowledge-graph-canvas"
                aria-label="Interactive Note Map"
                className="h-full w-full touch-none cursor-grab active:cursor-grabbing"
                onMouseDown={(e) => {
                  dragRef.current = { dragging: true, startX: e.clientX, startY: e.clientY };
                }}
                onMouseMove={(e) => {
                  if (dragRef.current.dragging) {
                    const dx = e.clientX - dragRef.current.startX;
                    const dy = e.clientY - dragRef.current.startY;
                    dragRef.current.startX = e.clientX;
                    dragRef.current.startY = e.clientY;
                    panRef.current.x += dx;
                    panRef.current.y += dy;
                    setPanTick((n) => n + 1);
                  }
                  setHoveredNode(findNodeAt(e.clientX, e.clientY));
                }}
                onMouseUp={() => {
                  dragRef.current.dragging = false;
                }}
                onTouchStart={(e) => {
                  const t = e.touches[0];
                  if (t) {
                    dragRef.current = { dragging: true, startX: t.clientX, startY: t.clientY };
                  }
                }}
                onTouchMove={(e) => {
                  const t = e.touches[0];
                  if (dragRef.current.dragging && t) {
                    const dx = t.clientX - dragRef.current.startX;
                    const dy = t.clientY - dragRef.current.startY;
                    dragRef.current.startX = t.clientX;
                    dragRef.current.startY = t.clientY;
                    panRef.current.x += dx;
                    panRef.current.y += dy;
                    setPanTick((n) => n + 1);
                  }
                }}
                onTouchEnd={() => {
                  dragRef.current.dragging = false;
                }}
                onClick={(e) => {
                  const hit = findNodeAt(e.clientX, e.clientY);
                  if (hit && hit.kind === 'note') {
                    setSelectedNoteId(hit.id);
                  }
                }}
              />

              {hoveredNode && (
                <div className="glass-overlay pointer-events-none absolute bottom-3 left-3 rounded-xl border border-border/80 px-3 py-2 text-xs shadow-md">
                  <div className="font-semibold text-foreground">{hoveredNode.label}</div>
                  <div className="text-muted-foreground">
                    {hoveredNode.kind === 'note' ? 'Tap to open note' : 'Tag group'} ·{' '}
                    {hoveredNode.degree} link(s)
                  </div>
                </div>
              )}
            </div>
          </Card>
        ) : (
          <Card className="flex-1 gap-0 overflow-y-auto py-0">
            <div className="divide-y divide-border/60">
              {events.map((ev) => (
                <div
                  key={ev.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3.5 text-xs sm:px-5"
                >
                  <div>
                    <span className="font-semibold text-primary">{ev.action}</span>{' '}
                    <span className="text-foreground">{ev.summary}</span>
                  </div>
                  <span className="shrink-0 font-mono tabular-nums text-muted-foreground">
                    {new Date(ev.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
