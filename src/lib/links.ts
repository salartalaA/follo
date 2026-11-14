import type { Note } from '../types/workspace';

export interface BacklinkReference {
  sourceNoteId: string;
  sourceTitle: string;
  excerpt: string;
  updatedAt: number;
}

export interface RelatedNoteMatch {
  noteId: string;
  title: string;
  score: number;
  sharedTags: string[];
  directLink: boolean;
}

export interface BrokenLinkIssue {
  noteId: string;
  noteTitle: string;
  missingTarget: string;
}

export interface DuplicateNoteGroup {
  reason: 'title' | 'content';
  key: string;
  notes: Array<{ id: string; title: string; updatedAt: number }>;
}

const WIKILINK_REGEX = /\[\[([^[\]|]+?)(?:\|[^[\]]+?)?\]\]/g;
const HASHTAG_REGEX = /(?:^|\s)#([a-zA-Z][a-zA-Z0-9_-]{1,39})/g;

export function normalizeLinkKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function extractWikilinks(text: string): string[] {
  const seen = new Set<string>();
  const results: string[] = [];
  for (const match of text.matchAll(WIKILINK_REGEX)) {
    const raw = match[1]?.trim();
    if (raw && !seen.has(normalizeLinkKey(raw))) {
      seen.add(normalizeLinkKey(raw));
      results.push(raw);
    }
  }
  return results;
}

export function extractInlineHashtags(text: string): string[] {
  const seen = new Set<string>();
  for (const match of text.matchAll(HASHTAG_REGEX)) {
    const tag = match[1]?.toLowerCase();
    if (tag) {
      seen.add(tag);
    }
  }
  return Array.from(seen);
}

export function computeBacklinks(targetNote: Note, allNotes: Note[]): BacklinkReference[] {
  const targetKey = normalizeLinkKey(targetNote.title);
  if (!targetKey) {
    return [];
  }

  const backlinks: BacklinkReference[] = [];
  for (const candidate of allNotes) {
    if (candidate.id === targetNote.id || candidate.isArchived) {
      continue;
    }
    const matchesTarget = candidate.wikilinks.some((link) => normalizeLinkKey(link) === targetKey);
    if (matchesTarget) {
      const idx = candidate.contentText.toLowerCase().indexOf(targetKey);
      let start = Math.max(0, idx - 45);
      if (start > 0) {
        const nextSpace = candidate.contentText.indexOf(' ', start);
        if (nextSpace !== -1 && nextSpace < idx) {
          start = nextSpace + 1;
        }
      }
      const end = Math.min(candidate.contentText.length, Math.max(idx, 0) + 95);
      const rawSlice = candidate.contentText.slice(start, end).trim();
      const excerpt =
        (start > 0 && rawSlice ? `...${rawSlice}` : rawSlice) ||
        candidate.contentText.slice(0, 110).trim();
      backlinks.push({
        sourceNoteId: candidate.id,
        sourceTitle: candidate.title,
        excerpt,
        updatedAt: candidate.updatedAt,
      });
    }
  }

  return backlinks.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function computeRelatedNotes(targetNote: Note, allNotes: Note[]): RelatedNoteMatch[] {
  const targetTags = new Set(targetNote.tags.map((t) => t.toLowerCase()));
  const targetLinks = new Set(targetNote.wikilinks.map(normalizeLinkKey));
  const targetKey = normalizeLinkKey(targetNote.title);

  const matches: RelatedNoteMatch[] = [];
  for (const other of allNotes) {
    if (other.id === targetNote.id || other.isArchived) {
      continue;
    }
    const sharedTags = other.tags.filter((tag) => targetTags.has(tag.toLowerCase()));
    const linksToTarget = other.wikilinks.some((l) => normalizeLinkKey(l) === targetKey);
    const linkedFromTarget = targetLinks.has(normalizeLinkKey(other.title));
    const directLink = linksToTarget || linkedFromTarget;
    const score = sharedTags.length * 2 + (directLink ? 5 : 0);

    if (score > 0) {
      matches.push({
        noteId: other.id,
        title: other.title,
        score,
        sharedTags,
        directLink,
      });
    }
  }

  return matches.sort((a, b) => b.score - a.score).slice(0, 8);
}

export function detectBrokenLinks(notes: Note[]): BrokenLinkIssue[] {
  const titleSet = new Set(notes.map((n) => normalizeLinkKey(n.title)).filter(Boolean));
  const issues: BrokenLinkIssue[] = [];

  for (const note of notes) {
    if (note.isArchived) {
      continue;
    }
    for (const target of note.wikilinks) {
      if (!titleSet.has(normalizeLinkKey(target))) {
        issues.push({
          noteId: note.id,
          noteTitle: note.title,
          missingTarget: target,
        });
      }
    }
  }

  return issues;
}

export function detectOrphanNotes(notes: Note[]): Note[] {
  const activeNotes = notes.filter((n) => !n.isArchived);
  const incomingCounts = new Map<string, number>();

  for (const note of activeNotes) {
    for (const link of note.wikilinks) {
      const key = normalizeLinkKey(link);
      incomingCounts.set(key, (incomingCounts.get(key) ?? 0) + 1);
    }
  }

  const titleSet = new Set(activeNotes.map((n) => normalizeLinkKey(n.title)));
  return activeNotes.filter((note) => {
    const hasIncoming = (incomingCounts.get(normalizeLinkKey(note.title)) ?? 0) > 0;
    const hasValidOutgoing = note.wikilinks.some(
      (l) =>
        normalizeLinkKey(l) !== normalizeLinkKey(note.title) && titleSet.has(normalizeLinkKey(l)),
    );
    return !hasIncoming && !hasValidOutgoing;
  });
}

export function detectDuplicateNotes(notes: Note[]): DuplicateNoteGroup[] {
  const byTitle = new Map<string, Note[]>();
  const byContent = new Map<string, Note[]>();

  for (const note of notes) {
    const titleKey = normalizeLinkKey(note.title);
    if (titleKey) {
      const list = byTitle.get(titleKey) ?? [];
      list.push(note);
      byTitle.set(titleKey, list);
    }

    const normalizedBody = note.contentText.trim().toLowerCase().replace(/\s+/g, ' ');
    if (normalizedBody.length >= 40) {
      const list = byContent.get(normalizedBody) ?? [];
      list.push(note);
      byContent.set(normalizedBody, list);
    }
  }

  const groups: DuplicateNoteGroup[] = [];
  for (const [key, group] of byTitle.entries()) {
    if (group.length > 1) {
      groups.push({
        reason: 'title',
        key,
        notes: group.map((n) => ({ id: n.id, title: n.title, updatedAt: n.updatedAt })),
      });
    }
  }

  for (const [key, group] of byContent.entries()) {
    if (group.length > 1) {
      groups.push({
        reason: 'content',
        key: key.slice(0, 60),
        notes: group.map((n) => ({ id: n.id, title: n.title, updatedAt: n.updatedAt })),
      });
    }
  }

  return groups;
}
