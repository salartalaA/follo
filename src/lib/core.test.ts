import assert from 'node:assert/strict';
import test from 'node:test';
import type { Note, TaskItem } from '../types/workspace';
import { computeLineDiff, computeWritingStats, extractOutlineFromHtml } from './diff';
import { buildKnowledgeGraph } from './graph';
import { runIntegrityAudit } from './integrity';
import {
  computeBacklinks,
  detectBrokenLinks,
  detectDuplicateNotes,
  detectOrphanNotes,
  extractInlineHashtags,
  extractWikilinks,
} from './links';
import {
  generateRtfFromText,
  htmlToMarkdown,
  htmlToPlainText,
  markdownToHtml,
  parseRtfToPlainText,
} from './markdown';
import { evaluateSmartCollection, searchWorkspaceEntities } from './search';
import { classifyTaskBucket, filterTasksByBucket, getTaskCounts } from './tasks';
import { validateBackupPayload } from './validators';

function makeNote(partial: Partial<Note> & { id: string; title: string }): Note {
  const now = 1_700_000_000_000;
  return {
    workspaceId: 'ws-personal',
    folderId: null,
    contentHtml: `<p>${partial.contentText ?? 'Body text'}</p>`,
    contentText: 'Body text',
    tags: [],
    wikilinks: [],
    isPinned: false,
    isFavorite: false,
    isArchived: false,
    isDailyNote: false,
    dailyDate: null,
    templateName: null,
    wordCount: 2,
    charCount: 9,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

function makeTask(partial: Partial<TaskItem> & { id: string; title: string }): TaskItem {
  const now = 1_700_000_000_000;
  return {
    workspaceId: 'ws-personal',
    description: '',
    completed: false,
    priority: 'medium',
    dueDate: null,
    reminderAt: null,
    subtasks: [],
    linkedNoteId: null,
    tags: [],
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    ...partial,
  };
}

test('wikilinks, backlinks, broken links, orphans, and duplicates work accurately', () => {
  assert.deepEqual(
    extractWikilinks('See [[Project Atlas]] and [[Reading List|Books]] and [[Project Atlas]]'),
    ['Project Atlas', 'Reading List'],
  );
  assert.deepEqual(extractInlineHashtags('Notes on #Architecture and #local-first design'), [
    'architecture',
    'local-first',
  ]);

  const n1 = makeNote({
    id: 'n1',
    title: 'Project Atlas',
    contentText: 'Core hub note linking to [[Missing Note]].',
    wikilinks: ['Missing Note'],
    tags: ['architecture'],
  });
  const n2 = makeNote({
    id: 'n2',
    title: 'Weekly Review',
    contentText: 'Reviewed [[Project Atlas]] milestones today.',
    wikilinks: ['Project Atlas'],
    tags: ['architecture'],
  });
  const n3 = makeNote({
    id: 'n3',
    title: 'Isolated Thought',
    contentText: 'Completely unlinked standalone note with enough length to check.',
    wikilinks: [],
  });
  const n4 = makeNote({
    id: 'n4',
    title: 'Project Atlas',
    contentText: 'Duplicate title note.',
    wikilinks: [],
  });

  const backlinks = computeBacklinks(n1, [n1, n2, n3]);
  assert.equal(backlinks.length, 1);
  assert.equal(backlinks[0]?.sourceNoteId, 'n2');

  const broken = detectBrokenLinks([n1, n2, n3]);
  assert.equal(broken.length, 1);
  assert.equal(broken[0]?.missingTarget, 'Missing Note');

  const orphans = detectOrphanNotes([n1, n2, n3]);
  assert.deepEqual(
    orphans.map((o) => o.id),
    ['n3'],
  );

  const duplicates = detectDuplicateNotes([n1, n2, n3, n4]);
  assert.equal(
    duplicates.some((g) => g.reason === 'title' && g.key === 'project atlas'),
    true,
  );
});

test('task bucketing and priority ordering handle today, overdue, upcoming, and completed', () => {
  const today = '2026-11-14';
  const t1 = makeTask({ id: 't1', title: 'Overdue low', dueDate: '2026-11-10', priority: 'low' });
  const t2 = makeTask({
    id: 't2',
    title: 'Today urgent',
    dueDate: '2026-11-14',
    priority: 'urgent',
  });
  const t3 = makeTask({
    id: 't3',
    title: 'Upcoming high',
    dueDate: '2026-11-20',
    priority: 'high',
  });
  const t4 = makeTask({ id: 't4', title: 'Done', dueDate: '2026-11-14', completed: true });

  assert.equal(classifyTaskBucket(t1, today), 'overdue');
  assert.equal(classifyTaskBucket(t2, today), 'today');
  assert.equal(classifyTaskBucket(t3, today), 'upcoming');
  assert.equal(classifyTaskBucket(t4, today), 'completed');

  const counts = getTaskCounts([t1, t2, t3, t4], today);
  assert.deepEqual(counts, { today: 1, upcoming: 1, overdue: 1, completed: 1, all: 4 });

  const sortedAll = filterTasksByBucket([t1, t2, t3, t4], 'all', today);
  assert.equal(sortedAll[0]?.id, 't2');
  assert.equal(sortedAll[sortedAll.length - 1]?.id, 't4');
});

test('diffing, writing stats, and HTML heading outline extraction', () => {
  const diff = computeLineDiff(
    'Line one\nLine two\nLine three',
    'Line one\nLine two edited\nLine three\nLine four',
  );
  assert.equal(
    diff.some((d) => d.type === 'removed' && d.text === 'Line two'),
    true,
  );
  assert.equal(
    diff.some((d) => d.type === 'added' && d.text === 'Line two edited'),
    true,
  );
  assert.equal(
    diff.some((d) => d.type === 'added' && d.text === 'Line four'),
    true,
  );

  const stats = computeWritingStats('Hello world.\n\nSecond paragraph here.');
  assert.equal(stats.words, 5);
  assert.equal(stats.paragraphs, 2);
  assert.equal(stats.readingMinutes, 1);

  const headings = extractOutlineFromHtml(
    '<h1>Title</h1><p>Body</p><h2>Section A</h2><h3>Sub</h3>',
  );
  assert.equal(headings.length, 3);
  assert.equal(headings[1]?.text, 'Section A');
});

test('markdown, html, plain text, and RTF roundtrips preserve structure', () => {
  const html = markdownToHtml('# Heading\n\nParagraph with **bold** text.');
  assert.equal(html.includes('<h1>Heading</h1>'), true);
  assert.equal(html.includes('<strong>bold</strong>'), true);

  const md = htmlToMarkdown('<h1>Heading</h1><p>Paragraph with <strong>bold</strong> text.</p>');
  assert.equal(md.includes('# Heading'), true);
  assert.equal(md.includes('**bold**'), true);

  const plain = htmlToPlainText('<h1>Heading</h1><p>Hello &amp; welcome</p>');
  assert.equal(plain, 'Heading\nHello & welcome');

  const rtf = generateRtfFromText('My Note', 'Line A\nLine B');
  const parsed = parseRtfToPlainText(rtf);
  assert.equal(parsed.includes('My Note'), true);
  assert.equal(parsed.includes('Line A'), true);
});

test('search, smart collections, graph builder, integrity audit, and backup validation', () => {
  const n1 = makeNote({
    id: 'n1',
    title: 'Local-First Architecture',
    contentText: 'IndexedDB stores documents offline with [[Sync Notes]].',
    tags: ['engineering'],
    wikilinks: ['Sync Notes'],
    isPinned: true,
  });
  const n2 = makeNote({
    id: 'n2',
    title: 'Sync Notes',
    contentText: 'CRDTs and offline snapshots.',
    tags: ['engineering'],
  });

  const hits = searchWorkspaceEntities(
    { notes: [n1, n2], tasks: [], bookmarks: [], snippets: [], attachments: [] },
    { query: 'IndexedDB', workspaceId: 'all', kind: 'all', tagFilter: '', includeArchived: false },
  );
  assert.equal(hits.length, 1);
  assert.equal(hits[0]?.id, 'n1');

  const smartHits = evaluateSmartCollection([n1, n2], { pinnedOnly: true, tag: 'engineering' });
  assert.equal(smartHits.length, 1);
  assert.equal(smartHits[0]?.id, 'n1');

  const graph = buildKnowledgeGraph([n1, n2], { includeTags: true, workspaceId: 'all' });
  assert.equal(graph.nodes.length, 3); // 2 notes + 1 tag
  assert.equal(graph.edges.length, 3); // 1 wikilink + 2 tag edges

  const report = runIntegrityAudit({
    workspaces: [
      { id: 'ws-personal', name: 'Personal', description: '', accent: '#3B5BDB', createdAt: 1 },
    ],
    folders: [],
    notes: [n1, n2],
    tasks: [],
    collections: [],
    collectionRows: [],
    attachments: [],
  });
  assert.equal(report.totalIssues, 0);

  const badBackup = validateBackupPayload({ app: 'other' });
  assert.equal(badBackup.valid, false);

  const goodBackup = validateBackupPayload({
    app: 'folio',
    schemaVersion: 1,
    exportedAt: Date.now(),
    workspaces: [
      { id: 'ws-personal', name: 'Personal', description: '', accent: '#3B5BDB', createdAt: 1 },
    ],
    notes: [n1],
    tasks: [],
  });
  assert.equal(goodBackup.valid, true);
});
