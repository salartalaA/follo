import type {
  AttachmentRecord,
  BookmarkItem,
  CodeSnippet,
  Note,
  SmartCollectionRule,
  TaskItem,
} from '../types/workspace';

export type SearchEntityKind = 'note' | 'task' | 'bookmark' | 'snippet' | 'attachment';

export interface UnifiedSearchResult {
  id: string;
  kind: SearchEntityKind;
  workspaceId: string;
  title: string;
  excerpt: string;
  tags: string[];
  updatedAt: number;
  score: number;
}

export interface SearchFilterOptions {
  query: string;
  workspaceId: string | 'all';
  kind: 'all' | 'notes' | 'tasks' | 'bookmarks' | 'snippets' | 'attachments';
  tagFilter: string;
  includeArchived: boolean;
}

function makeExcerpt(text: string, queryLower: string): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) {
    return '';
  }
  if (!queryLower) {
    return clean.slice(0, 140);
  }
  const idx = clean.toLowerCase().indexOf(queryLower);
  if (idx === -1) {
    return clean.slice(0, 140);
  }
  const start = Math.max(0, idx - 45);
  const end = Math.min(clean.length, idx + queryLower.length + 95);
  return `${start > 0 ? '...' : ''}${clean.slice(start, end)}${end < clean.length ? '...' : ''}`;
}

export function searchWorkspaceEntities(
  data: {
    notes: Note[];
    tasks: TaskItem[];
    bookmarks: BookmarkItem[];
    snippets: CodeSnippet[];
    attachments: AttachmentRecord[];
  },
  options: SearchFilterOptions,
): UnifiedSearchResult[] {
  const q = options.query.trim().toLowerCase();
  const tag = options.tagFilter.trim().toLowerCase();
  const results: UnifiedSearchResult[] = [];

  const matchesWorkspace = (wsId: string) =>
    options.workspaceId === 'all' || wsId === options.workspaceId;

  const matchesTag = (tags: string[]) => !tag || tags.some((t) => t.toLowerCase().includes(tag));

  if (options.kind === 'all' || options.kind === 'notes') {
    for (const note of data.notes) {
      if (!options.includeArchived && note.isArchived) {
        continue;
      }
      if (!matchesWorkspace(note.workspaceId) || !matchesTag(note.tags)) {
        continue;
      }
      const titleHit = q ? note.title.toLowerCase().includes(q) : true;
      const bodyHit = q ? note.contentText.toLowerCase().includes(q) : true;
      const tagHit = q ? note.tags.some((t) => t.toLowerCase().includes(q)) : false;
      if (titleHit || bodyHit || tagHit) {
        results.push({
          id: note.id,
          kind: 'note',
          workspaceId: note.workspaceId,
          title: note.title || 'Untitled Note',
          excerpt: makeExcerpt(note.contentText, q),
          tags: note.tags,
          updatedAt: note.updatedAt,
          score:
            (titleHit ? 10 : 0) + (tagHit ? 5 : 0) + (bodyHit ? 2 : 0) + (note.isPinned ? 3 : 0),
        });
      }
    }
  }

  if (options.kind === 'all' || options.kind === 'tasks') {
    for (const task of data.tasks) {
      if (!matchesWorkspace(task.workspaceId) || !matchesTag(task.tags)) {
        continue;
      }
      const titleHit = q ? task.title.toLowerCase().includes(q) : true;
      const descHit = q ? task.description.toLowerCase().includes(q) : true;
      if (titleHit || descHit) {
        results.push({
          id: task.id,
          kind: 'task',
          workspaceId: task.workspaceId,
          title: task.title,
          excerpt: makeExcerpt(
            task.description || (task.dueDate ? `Due ${task.dueDate}` : 'Task'),
            q,
          ),
          tags: task.tags,
          updatedAt: task.updatedAt,
          score: (titleHit ? 9 : 0) + (descHit ? 2 : 0),
        });
      }
    }
  }

  if (options.kind === 'all' || options.kind === 'bookmarks') {
    for (const bm of data.bookmarks) {
      if (!matchesWorkspace(bm.workspaceId) || !matchesTag(bm.tags)) {
        continue;
      }
      const titleHit = q ? bm.title.toLowerCase().includes(q) : true;
      const urlHit = q ? bm.url.toLowerCase().includes(q) : false;
      const descHit = q ? bm.description.toLowerCase().includes(q) : false;
      if (titleHit || urlHit || descHit) {
        results.push({
          id: bm.id,
          kind: 'bookmark',
          workspaceId: bm.workspaceId,
          title: bm.title,
          excerpt: makeExcerpt(`${bm.url} — ${bm.description}`, q),
          tags: bm.tags,
          updatedAt: bm.createdAt,
          score: (titleHit ? 8 : 0) + (urlHit ? 4 : 0) + (descHit ? 2 : 0),
        });
      }
    }
  }

  if (options.kind === 'all' || options.kind === 'snippets') {
    for (const sn of data.snippets) {
      if (!matchesWorkspace(sn.workspaceId) || !matchesTag(sn.tags)) {
        continue;
      }
      const titleHit = q ? sn.title.toLowerCase().includes(q) : true;
      const codeHit = q ? sn.code.toLowerCase().includes(q) : false;
      const langHit = q ? sn.language.toLowerCase().includes(q) : false;
      if (titleHit || codeHit || langHit) {
        results.push({
          id: sn.id,
          kind: 'snippet',
          workspaceId: sn.workspaceId,
          title: sn.title,
          excerpt: makeExcerpt(sn.code, q),
          tags: sn.tags,
          updatedAt: sn.updatedAt,
          score: (titleHit ? 8 : 0) + (langHit ? 4 : 0) + (codeHit ? 3 : 0),
        });
      }
    }
  }

  if (options.kind === 'all' || options.kind === 'attachments') {
    for (const att of data.attachments) {
      if (!matchesWorkspace(att.workspaceId) || tag) {
        continue;
      }
      const nameHit = q ? att.name.toLowerCase().includes(q) : true;
      const textHit = q ? att.extractedText.toLowerCase().includes(q) : false;
      if (nameHit || textHit) {
        results.push({
          id: att.id,
          kind: 'attachment',
          workspaceId: att.workspaceId,
          title: att.name,
          excerpt: makeExcerpt(
            att.extractedText || `${att.mimeType} (${Math.round(att.size / 1024)} KB)`,
            q,
          ),
          tags: [],
          updatedAt: att.createdAt,
          score: (nameHit ? 7 : 0) + (textHit ? 3 : 0),
        });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score || b.updatedAt - a.updatedAt);
}

export function evaluateSmartCollection(
  notes: Note[],
  rule: SmartCollectionRule,
  nowMs: number = Date.now(),
): Note[] {
  return notes.filter((note) => {
    if (!rule.includeArchived && note.isArchived) {
      return false;
    }
    if (rule.workspaceId && rule.workspaceId !== 'all' && note.workspaceId !== rule.workspaceId) {
      return false;
    }
    if (rule.pinnedOnly && !note.isPinned) {
      return false;
    }
    if (rule.favoriteOnly && !note.isFavorite) {
      return false;
    }
    if (rule.hasWikilinks && note.wikilinks.length === 0) {
      return false;
    }
    if (rule.tag) {
      const targetTag = rule.tag.trim().toLowerCase();
      if (!note.tags.some((t) => t.toLowerCase() === targetTag)) {
        return false;
      }
    }
    if (typeof rule.updatedWithinDays === 'number' && rule.updatedWithinDays > 0) {
      const cutoff = nowMs - rule.updatedWithinDays * 24 * 60 * 60 * 1000;
      if (note.updatedAt < cutoff) {
        return false;
      }
    }
    if (rule.queryText && rule.queryText.trim().length > 0) {
      const q = rule.queryText.trim().toLowerCase();
      const hit =
        note.title.toLowerCase().includes(q) ||
        note.contentText.toLowerCase().includes(q) ||
        note.tags.some((t) => t.toLowerCase().includes(q));
      if (!hit) {
        return false;
      }
    }
    return true;
  });
}
