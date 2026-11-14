import { computeWritingStats } from '../lib/diff';
import { extractWikilinks } from '../lib/links';
import { htmlToPlainText } from '../lib/markdown';
import { getTodayIsoDate } from '../lib/tasks';
import type {
  ActivityEvent,
  AttachmentRecord,
  BookmarkItem,
  CodeSnippet,
  CollectionRow,
  Folder,
  InboxItem,
  Note,
  NoteVersion,
  PdfAnnotation,
  SavedSearch,
  SmartCollection,
  StructuredCollection,
  TaskItem,
  Workspace,
} from '../types/workspace';
import { db } from './database';

function makeNoteRecord(input: {
  id: string;
  workspaceId: string;
  folderId: string | null;
  title: string;
  contentHtml: string;
  tags: string[];
  isPinned?: boolean;
  isFavorite?: boolean;
  isDailyNote?: boolean;
  dailyDate?: string | null;
  createdAt: number;
  updatedAt: number;
}): Note {
  const contentText = htmlToPlainText(input.contentHtml);
  const stats = computeWritingStats(contentText);
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    folderId: input.folderId,
    title: input.title,
    contentHtml: input.contentHtml,
    contentText,
    tags: input.tags,
    wikilinks: extractWikilinks(`${input.title}\n${contentText}`),
    isPinned: Boolean(input.isPinned),
    isFavorite: Boolean(input.isFavorite),
    isArchived: false,
    isDailyNote: Boolean(input.isDailyNote),
    dailyDate: input.dailyDate ?? null,
    templateName: null,
    wordCount: stats.words,
    charCount: stats.characters,
    createdAt: input.createdAt,
    updatedAt: input.updatedAt,
  };
}

function createSamplePdfBlob(): Blob {
  const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
endobj
4 0 obj
<< /Length 285 >>
stream
BT
/F1 20 Tf
56 710 Td
(Weekend Farmers Market & Seasonal Guide) Tj
/F1 12 Tf
0 -34 Td
(1. Fresh berries, heirloom tomatoes, and sourdough bread every Saturday morning.) Tj
0 -22 Td
(2. Bring reusable tote bags and small bills for local farm stands.) Tj
0 -22 Td
(3. Save favorite recipes and grocery notes right inside your personal space.) Tj
ET
endstream
endobj
5 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000241 00000 n 
0000000577 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
645
%%EOF`;
  return new Blob([pdfContent], { type: 'application/pdf' });
}

let seedPromise: Promise<void> | null = null;

export function ensureDatabaseSeeded(): Promise<void> {
  if (!seedPromise) {
    seedPromise = seedIfEmpty();
  }
  return seedPromise;
}

async function seedIfEmpty(): Promise<void> {
  const existingWorkspaces = await db.workspaces.count();
  if (existingWorkspaces > 0) {
    return;
  }

  const now = Date.now();
  const todayIso = getTodayIsoDate(new Date(now));
  const hour = 3_600_000;
  const day = 86_400_000;

  const workspaces: Workspace[] = [
    {
      id: 'ws-personal',
      name: 'Personal',
      description: 'Daily notes, ideas, checklists, and things you want to remember.',
      accent: '#3B5BDB',
      createdAt: now - 14 * day,
    },
    {
      id: 'ws-work',
      name: 'Work',
      description: 'Meeting notes, action items, and shared plans.',
      accent: '#0F766E',
      createdAt: now - 12 * day,
    },
    {
      id: 'ws-study',
      name: 'Study',
      description: 'Class notes, reading highlights, and study guides.',
      accent: '#B45309',
      createdAt: now - 10 * day,
    },
    {
      id: 'ws-projects',
      name: 'Projects',
      description: 'Home improvements, trips, and creative plans.',
      accent: '#6D28D9',
      createdAt: now - 8 * day,
    },
  ];

  const folders: Folder[] = [
    {
      id: 'fld-foundations',
      workspaceId: 'ws-personal',
      parentId: null,
      name: 'My Notes',
      order: 1,
      createdAt: now - 10 * day,
    },
    {
      id: 'fld-daily',
      workspaceId: 'ws-personal',
      parentId: null,
      name: 'Daily Journal',
      order: 2,
      createdAt: now - 10 * day,
    },
    {
      id: 'fld-reading',
      workspaceId: 'ws-personal',
      parentId: 'fld-foundations',
      name: 'Reading & Recipes',
      order: 1,
      createdAt: now - 9 * day,
    },
    {
      id: 'fld-work-specs',
      workspaceId: 'ws-work',
      parentId: null,
      name: 'Meetings',
      order: 1,
      createdAt: now - 9 * day,
    },
    {
      id: 'fld-study-cs',
      workspaceId: 'ws-study',
      parentId: null,
      name: 'Language & Study',
      order: 1,
      createdAt: now - 7 * day,
    },
    {
      id: 'fld-proj-atlas',
      workspaceId: 'ws-projects',
      parentId: null,
      name: 'Home & Trips',
      order: 1,
      createdAt: now - 6 * day,
    },
  ];

  const notes: Note[] = [
    makeNoteRecord({
      id: 'note-welcome',
      workspaceId: 'ws-personal',
      folderId: 'fld-foundations',
      title: 'Welcome to Folio',
      isPinned: true,
      isFavorite: true,
      tags: ['personal', 'guide'],
      createdAt: now - 7 * day,
      updatedAt: now - 2 * hour,
      contentHtml: `<p>Your quiet, private space for notes, daily lists, links, and important files. Everything you save stays right here on your device—even without internet.</p>
<h2>Simple Ways to Use Folio</h2>
<ul><li><p><strong>Capture fast:</strong> Tap the <strong>+</strong> button anytime to jot down a quick thought, reminder, or web link.</p></li><li><p><strong>Stay organized:</strong> Keep your [[Weekend Trip Ideas]] and [[Summer Reading List]] in one place.</p></li><li><p><strong>Daily pages:</strong> Check in each morning with your daily journal and today&apos;s to-dos.</p></li></ul>
<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>Try checking off an item on your list</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Write down one idea or goal for this week</p></div></li></ul>`,
    }),
    makeNoteRecord({
      id: 'note-knowledge-arch',
      workspaceId: 'ws-personal',
      folderId: 'fld-foundations',
      title: 'Weekend Trip Ideas',
      isFavorite: true,
      tags: ['travel', 'weekend'],
      createdAt: now - 6 * day,
      updatedAt: now - 4 * hour,
      contentHtml: `<p>Ideas for a relaxing two-day coastal drive. Remember to bring a couple of books from [[Summer Reading List]].</p>
<h2>Packing Essentials</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>Light jacket and comfortable walking shoes</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Phone charger, sunglasses, and water bottle</p></div></li></ul>
<h2>Spots to Visit</h2>
<ul><li><p>Morning coffee at the harbor bakery</p></li><li><p>Sunset walk along the cliffs</p></li></ul>`,
    }),
    makeNoteRecord({
      id: 'note-reading-list',
      workspaceId: 'ws-personal',
      folderId: 'fld-reading',
      title: 'Summer Reading List',
      tags: ['books', 'reading'],
      createdAt: now - 5 * day,
      updatedAt: now - 1 * day,
      contentHtml: `<p>Books recommended by friends to enjoy over coffee or on my [[Weekend Trip Ideas]] getaway.</p>
<blockquote><p>A good book feels like a long conversation with an old friend.</p></blockquote>
<ul><li><p><strong>Four Thousand Weeks</strong> — Oliver Burkeman</p></li><li><p><strong>Atomic Habits</strong> — James Clear</p></li><li><p><strong>Tomorrow, and Tomorrow, and Tomorrow</strong> — Gabrielle Zevin</p></li></ul>`,
    }),
    makeNoteRecord({
      id: 'note-daily-today',
      workspaceId: 'ws-personal',
      folderId: 'fld-daily',
      title: `Daily Note — ${todayIso}`,
      isDailyNote: true,
      dailyDate: todayIso,
      tags: ['daily'],
      createdAt: now - 3 * hour,
      updatedAt: now - 30 * 60_000,
      contentHtml: `<p>Focus for today: keep things simple, finish errands early, and take an evening walk.</p>
<h2>Today&apos;s Priorities</h2>
<ul data-type="taskList"><li data-type="taskItem" data-checked="true"><label><input type="checkbox" checked><span></span></label><div><p>Reply to Sarah&apos;s message about dinner</p></div></li><li data-type="taskItem" data-checked="false"><label><input type="checkbox"><span></span></label><div><p>Pick up groceries on the way home</p></div></li></ul>`,
    }),
    makeNoteRecord({
      id: 'note-project-atlas',
      workspaceId: 'ws-projects',
      folderId: 'fld-proj-atlas',
      title: 'Balcony Herb Garden Plan',
      isPinned: true,
      tags: ['home', 'plants'],
      createdAt: now - 4 * day,
      updatedAt: now - 5 * hour,
      contentHtml: `<p>Setting up three small terracotta planters with basil, mint, and rosemary on the sunny side of the balcony.</p>
<h2>Shopping List</h2>
<ul><li><p>Potting soil and clay pebbles</p></li><li><p>Basil, mint, and rosemary starter pots</p></div></li></ul>`,
    }),
    makeNoteRecord({
      id: 'note-work-spec',
      workspaceId: 'ws-work',
      folderId: 'fld-work-specs',
      title: 'Weekly Team Sync Notes',
      tags: ['work', 'meetings'],
      createdAt: now - 3 * day,
      updatedAt: now - 8 * hour,
      contentHtml: `<p>Quick recap of this week&apos;s priorities, upcoming deadlines, and who is handling each follow-up.</p>
<ul><li><p>Send updated schedule to the team before Friday</p></li><li><p>Confirm room booking for Tuesday&apos;s workshop</p></li></ul>`,
    }),
    makeNoteRecord({
      id: 'note-study-crdt',
      workspaceId: 'ws-study',
      folderId: 'fld-study-cs',
      title: 'Spanish Travel Phrases',
      tags: ['study', 'spanish'],
      createdAt: now - 2 * day,
      updatedAt: now - 10 * hour,
      contentHtml: `<p>Helpful everyday phrases to practice for 10 minutes before bed.</p>
<ul><li><p><strong>La cuenta, por favor</strong> — The check, please</p></li><li><p><strong>¿Dónde está la estación?</strong> — Where is the station?</p></li></ul>`,
    }),
  ];

  const noteVersions: NoteVersion[] = [
    {
      id: 'ver-welcome-1',
      noteId: 'note-welcome',
      title: 'Welcome to Folio',
      contentHtml: '<p>A simple personal notebook for notes, tasks, and ideas.</p>',
      contentText: 'A simple personal notebook for notes, tasks, and ideas.',
      summary: 'First draft',
      createdAt: now - 5 * day,
    },
    {
      id: 'ver-welcome-2',
      noteId: 'note-welcome',
      title: 'Welcome to Folio',
      contentHtml: notes[0].contentHtml,
      contentText: notes[0].contentText,
      summary: 'Added quick tips and checklist',
      createdAt: now - 2 * hour,
    },
  ];

  const inboxItems: InboxItem[] = [
    {
      id: 'inb-1',
      workspaceId: 'ws-personal',
      kind: 'idea',
      title: 'Gift idea for Mom — handmade ceramic teapot',
      content: 'Check the pottery shop downtown next Saturday afternoon.',
      url: null,
      language: null,
      attachmentId: null,
      tags: ['gifts'],
      processed: false,
      convertedTarget: null,
      createdAt: now - 90 * 60_000,
    },
    {
      id: 'inb-2',
      workspaceId: 'ws-personal',
      kind: 'link',
      title: '20-Minute Creamy Garlic Pasta Recipe',
      content: 'Great weeknight dinner idea using pantry staples and fresh basil.',
      url: 'https://cooking.nytimes.com',
      language: null,
      attachmentId: null,
      tags: ['recipes'],
      processed: false,
      convertedTarget: null,
      createdAt: now - 4 * hour,
    },
    {
      id: 'inb-3',
      workspaceId: 'ws-personal',
      kind: 'task',
      title: 'Drop off dry cleaning before 6 PM',
      content: 'Ticket is in the kitchen drawer.',
      url: null,
      language: null,
      attachmentId: null,
      tags: ['errands'],
      processed: false,
      convertedTarget: null,
      createdAt: now - 6 * hour,
    },
  ];

  const yesterdayIso = getTodayIsoDate(new Date(now - day));
  const tomorrowIso = getTodayIsoDate(new Date(now + day));
  const nextWeekIso = getTodayIsoDate(new Date(now + 4 * day));

  const tasks: TaskItem[] = [
    {
      id: 'tsk-1',
      workspaceId: 'ws-personal',
      title: 'Pick up groceries on the way home',
      description: 'Everything needed for tonight and breakfast tomorrow.',
      completed: false,
      priority: 'high',
      dueDate: todayIso,
      reminderAt: null,
      subtasks: [
        { id: 'sub-1', title: 'Fresh fruit & coffee beans', completed: true },
        { id: 'sub-2', title: 'Olive oil & sourdough bread', completed: false },
      ],
      linkedNoteId: 'note-daily-today',
      tags: ['errands'],
      createdAt: now - 2 * day,
      updatedAt: now - 3 * hour,
      completedAt: null,
    },
    {
      id: 'tsk-2',
      workspaceId: 'ws-personal',
      title: 'Pay monthly electricity bill',
      description: 'Confirm autopay is enabled for next month.',
      completed: false,
      priority: 'urgent',
      dueDate: yesterdayIso,
      reminderAt: null,
      subtasks: [],
      linkedNoteId: null,
      tags: ['home'],
      createdAt: now - 3 * day,
      updatedAt: now - 1 * day,
      completedAt: null,
    },
    {
      id: 'tsk-3',
      workspaceId: 'ws-personal',
      title: 'Book routine dentist checkup',
      description: 'Ask for an afternoon slot next week.',
      completed: false,
      priority: 'medium',
      dueDate: tomorrowIso,
      reminderAt: null,
      subtasks: [],
      linkedNoteId: null,
      tags: ['health'],
      createdAt: now - 2 * day,
      updatedAt: now - 5 * hour,
      completedAt: null,
    },
    {
      id: 'tsk-4',
      workspaceId: 'ws-work',
      title: 'Send Friday schedule update email',
      description: 'Share notes from Tuesday sync with the team.',
      completed: false,
      priority: 'high',
      dueDate: nextWeekIso,
      reminderAt: null,
      subtasks: [],
      linkedNoteId: 'note-work-spec',
      tags: ['work'],
      createdAt: now - 2 * day,
      updatedAt: now - 8 * hour,
      completedAt: null,
    },
    {
      id: 'tsk-5',
      workspaceId: 'ws-personal',
      title: 'Organize desk drawer',
      description: 'Sorted chargers, pens, and spare keys.',
      completed: true,
      priority: 'low',
      dueDate: yesterdayIso,
      reminderAt: null,
      subtasks: [],
      linkedNoteId: null,
      tags: ['home'],
      createdAt: now - 5 * day,
      updatedAt: now - 2 * day,
      completedAt: now - 2 * day,
    },
  ];

  const collections: StructuredCollection[] = [
    {
      id: 'col-reading',
      workspaceId: 'ws-personal',
      name: 'Books & Movies to Enjoy',
      description: 'A simple list of recommendations from friends.',
      fields: [
        { id: 'f-title', name: 'Title', type: 'text' },
        { id: 'f-author', name: 'Author', type: 'text' },
        {
          id: 'f-status',
          name: 'Status',
          type: 'select',
          options: ['Want to Try', 'In Progress', 'Finished'],
        },
        { id: 'f-rating', name: 'Rating', type: 'number' },
        { id: 'f-finished', name: 'Favorite', type: 'checkbox' },
        { id: 'f-date', name: 'Updated', type: 'date' },
      ],
      createdAt: now - 6 * day,
      updatedAt: now - 1 * day,
    },
  ];

  const collectionRows: CollectionRow[] = [
    {
      id: 'row-1',
      collectionId: 'col-reading',
      workspaceId: 'ws-personal',
      values: {
        'f-title': 'Four Thousand Weeks',
        'f-author': 'Oliver Burkeman',
        'f-status': 'Finished',
        'f-rating': 5,
        'f-finished': true,
        'f-date': yesterdayIso,
      },
      createdAt: now - 6 * day,
      updatedAt: now - 2 * day,
    },
    {
      id: 'row-2',
      collectionId: 'col-reading',
      workspaceId: 'ws-personal',
      values: {
        'f-title': 'Atomic Habits',
        'f-author': 'James Clear',
        'f-status': 'In Progress',
        'f-rating': 4,
        'f-finished': false,
        'f-date': todayIso,
      },
      createdAt: now - 4 * day,
      updatedAt: now - 1 * day,
    },
    {
      id: 'row-3',
      collectionId: 'col-reading',
      workspaceId: 'ws-personal',
      values: {
        'f-title': 'Past Lives',
        'f-author': 'Celine Song',
        'f-status': 'Want to Try',
        'f-rating': 5,
        'f-finished': false,
        'f-date': todayIso,
      },
      createdAt: now - 3 * day,
      updatedAt: now - 1 * day,
    },
  ];

  const samplePdfBlob = createSamplePdfBlob();
  const attachments: AttachmentRecord[] = [
    {
      id: 'att-sample-pdf',
      workspaceId: 'ws-personal',
      name: 'Weekend-Farmers-Market-Guide.pdf',
      mimeType: 'application/pdf',
      size: samplePdfBlob.size,
      blob: samplePdfBlob,
      extractedText:
        'Weekend Farmers Market & Seasonal Guide. Fresh berries, heirloom tomatoes, and sourdough bread every Saturday morning.',
      linkedNoteId: 'note-welcome',
      createdAt: now - 2 * day,
    },
  ];

  const pdfAnnotations: PdfAnnotation[] = [
    {
      id: 'ann-1',
      attachmentId: 'att-sample-pdf',
      workspaceId: 'ws-personal',
      pageNumber: 1,
      kind: 'highlight',
      color: 'cobalt',
      excerpt: 'Fresh berries, heirloom tomatoes, and sourdough bread every Saturday morning.',
      comment: 'Go around 9 AM before sourdough sells out.',
      createdAt: now - day,
    },
  ];

  const snippets: CodeSnippet[] = [
    {
      id: 'snp-1',
      workspaceId: 'ws-personal',
      title: 'Simple Monthly Budget Split',
      language: 'text',
      description: 'Quick 50 / 30 / 20 guideline to keep saved for reference.',
      code: '50% Needs (Rent, Groceries, Bills)\n30% Wants (Dining, Travel, Hobbies)\n20% Savings & Emergency Fund',
      tags: ['budget', 'personal'],
      isFavorite: true,
      createdAt: now - 3 * day,
      updatedAt: now - 1 * day,
    },
  ];

  const bookmarks: BookmarkItem[] = [
    {
      id: 'bmk-1',
      workspaceId: 'ws-personal',
      title: 'Minimalist Weekend Packing List',
      url: 'https://zenhabits.net',
      description: 'Light carry-on checklist for short trips.',
      tags: ['travel'],
      isFavorite: true,
      createdAt: now - 4 * day,
    },
    {
      id: 'bmk-2',
      workspaceId: 'ws-personal',
      title: '15-Minute Weeknight Recipes',
      url: 'https://www.seriouseats.com',
      description: 'Fast dinners when short on time.',
      tags: ['cooking'],
      isFavorite: false,
      createdAt: now - 2 * day,
    },
  ];

  const smartCollections: SmartCollection[] = [
    {
      id: 'smt-1',
      name: 'Pinned Notes',
      description: 'Important notes kept at the top.',
      rule: { workspaceId: 'all', pinnedOnly: true },
      createdAt: now - 5 * day,
    },
    {
      id: 'smt-2',
      name: 'Edited This Week',
      description: 'Notes updated in the last 7 days.',
      rule: { workspaceId: 'all', updatedWithinDays: 7 },
      createdAt: now - 3 * day,
    },
  ];

  const savedSearches: SavedSearch[] = [
    {
      id: 'sch-1',
      name: 'Weekend & Travel',
      query: 'Weekend',
      entityFilter: 'all',
      tagFilter: '',
      workspaceId: 'all',
      createdAt: now - 2 * day,
    },
  ];

  const activityEvents: ActivityEvent[] = [
    {
      id: 'act-1',
      workspaceId: 'ws-personal',
      entityType: 'note',
      entityId: 'note-welcome',
      action: 'Updated',
      summary: 'Updated "Welcome to Folio"',
      createdAt: now - 2 * hour,
    },
    {
      id: 'act-2',
      workspaceId: 'ws-personal',
      entityType: 'attachment',
      entityId: 'att-sample-pdf',
      action: 'Saved',
      summary: 'Added highlight to Weekend-Farmers-Market-Guide.pdf',
      createdAt: now - day,
    },
    {
      id: 'act-3',
      workspaceId: 'ws-personal',
      entityType: 'task',
      entityId: 'tsk-5',
      action: 'Completed',
      summary: 'Checked off "Organize desk drawer"',
      createdAt: now - 2 * day,
    },
  ];

  await db.transaction(
    'rw',
    [
      db.workspaces,
      db.folders,
      db.notes,
      db.noteVersions,
      db.inboxItems,
      db.tasks,
      db.collections,
      db.collectionRows,
      db.attachments,
      db.pdfAnnotations,
      db.snippets,
      db.bookmarks,
      db.smartCollections,
      db.savedSearches,
      db.activityEvents,
    ],
    async () => {
      await db.workspaces.bulkPut(workspaces);
      await db.folders.bulkPut(folders);
      await db.notes.bulkPut(notes);
      await db.noteVersions.bulkPut(noteVersions);
      await db.inboxItems.bulkPut(inboxItems);
      await db.tasks.bulkPut(tasks);
      await db.collections.bulkPut(collections);
      await db.collectionRows.bulkPut(collectionRows);
      await db.attachments.bulkPut(attachments);
      await db.pdfAnnotations.bulkPut(pdfAnnotations);
      await db.snippets.bulkPut(snippets);
      await db.bookmarks.bulkPut(bookmarks);
      await db.smartCollections.bulkPut(smartCollections);
      await db.savedSearches.bulkPut(savedSearches);
      await db.activityEvents.bulkPut(activityEvents);
    },
  );
}
