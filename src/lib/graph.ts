import type { Note } from '../types/workspace';
import { normalizeLinkKey } from './links';

export interface GraphNode {
  id: string;
  label: string;
  kind: 'note' | 'tag';
  workspaceId: string;
  degree: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  kind: 'wikilink' | 'tag';
}

export interface KnowledgeGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export function buildKnowledgeGraph(
  notes: Note[],
  options: { includeTags: boolean; workspaceId: string | 'all' },
): KnowledgeGraphData {
  const activeNotes = notes.filter(
    (n) =>
      !n.isArchived && (options.workspaceId === 'all' || n.workspaceId === options.workspaceId),
  );

  const noteByTitle = new Map<string, Note>();
  for (const n of activeNotes) {
    noteByTitle.set(normalizeLinkKey(n.title), n);
  }

  const nodeMap = new Map<string, GraphNode>();
  const edges: GraphEdge[] = [];
  const edgeKeys = new Set<string>();

  const total = Math.max(1, activeNotes.length);
  activeNotes.forEach((note, idx) => {
    const angle = (idx / total) * Math.PI * 2;
    const radius = 140 + (idx % 3) * 45;
    nodeMap.set(note.id, {
      id: note.id,
      label: note.title || 'Untitled',
      kind: 'note',
      workspaceId: note.workspaceId,
      degree: 0,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      vx: 0,
      vy: 0,
    });
  });

  for (const note of activeNotes) {
    for (const targetTitle of note.wikilinks) {
      const targetNote = noteByTitle.get(normalizeLinkKey(targetTitle));
      if (targetNote && targetNote.id !== note.id) {
        const key = [note.id, targetNote.id].sort().join('::');
        if (!edgeKeys.has(key)) {
          edgeKeys.add(key);
          edges.push({ source: note.id, target: targetNote.id, kind: 'wikilink' });
          const srcNode = nodeMap.get(note.id);
          const dstNode = nodeMap.get(targetNote.id);
          if (srcNode) srcNode.degree += 1;
          if (dstNode) dstNode.degree += 1;
        }
      }
    }

    if (options.includeTags) {
      for (const rawTag of note.tags) {
        const tagId = `tag:${rawTag.toLowerCase()}`;
        if (!nodeMap.has(tagId)) {
          const hash = rawTag.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
          const angle = (hash % 360) * (Math.PI / 180);
          nodeMap.set(tagId, {
            id: tagId,
            label: `#${rawTag}`,
            kind: 'tag',
            workspaceId: note.workspaceId,
            degree: 0,
            x: Math.cos(angle) * 230,
            y: Math.sin(angle) * 230,
            vx: 0,
            vy: 0,
          });
        }
        const edgeKey = `${note.id}::${tagId}`;
        if (!edgeKeys.has(edgeKey)) {
          edgeKeys.add(edgeKey);
          edges.push({ source: note.id, target: tagId, kind: 'tag' });
          const srcNode = nodeMap.get(note.id);
          const tagNode = nodeMap.get(tagId);
          if (srcNode) srcNode.degree += 1;
          if (tagNode) tagNode.degree += 1;
        }
      }
    }
  }

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
  };
}

export function stepForceLayout(nodes: GraphNode[], edges: GraphEdge[]): void {
  const byId = new Map<string, GraphNode>();
  for (const node of nodes) {
    byId.set(node.id, node);
  }

  // Repulsion
  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const a = nodes[i];
      const b = nodes[j];
      const dx = b.x - a.x || 0.5;
      const dy = b.y - a.y || 0.5;
      const distSq = Math.max(120, dx * dx + dy * dy);
      const force = 2600 / distSq;
      const fx = (dx / Math.sqrt(distSq)) * force;
      const fy = (dy / Math.sqrt(distSq)) * force;
      a.vx -= fx;
      a.vy -= fy;
      b.vx += fx;
      b.vy += fy;
    }
  }

  // Spring attraction along edges
  for (const edge of edges) {
    const src = byId.get(edge.source);
    const dst = byId.get(edge.target);
    if (!src || !dst) continue;
    const dx = dst.x - src.x;
    const dy = dst.y - src.y;
    const dist = Math.sqrt(dx * dx + dy * dy) || 1;
    const ideal = edge.kind === 'wikilink' ? 120 : 95;
    const strength = (dist - ideal) * 0.035;
    const fx = (dx / dist) * strength;
    const fy = (dy / dist) * strength;
    src.vx += fx;
    src.vy += fy;
    dst.vx -= fx;
    dst.vy -= fy;
  }

  // Center gravity + damping
  for (const node of nodes) {
    node.vx += -node.x * 0.008;
    node.vy += -node.y * 0.008;
    node.vx *= 0.82;
    node.vy *= 0.82;
    node.x += node.vx;
    node.y += node.vy;
  }
}
