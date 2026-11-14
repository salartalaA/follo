import { computeWritingStats } from '../lib/diff';
import { extractInlineHashtags, extractWikilinks } from '../lib/links';
import { htmlToPlainText } from '../lib/markdown';
import { getTodayIsoDate } from '../lib/tasks';
import { NOTE_TEMPLATES } from '../lib/templates';
import type {
  ActivityEvent,
  AttachmentRecord,
  BookmarkItem,
  CodeSnippet,
  CollectionCellValue,
  CollectionField,
  CollectionRow,
  Folder,
  InboxItem,
  InboxItemKind,
  Note,
  NoteVersion,
  PdfAnnotation,
  SmartCollection,
  StructuredCollection,
  TaskItem,
  TaskPriority,
} from '../types/workspace';
import { db } from './database';

export function uid(prefix: string): string {
  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${Date.now().toString(36)}-${randomPart}`;
}

export async function logActivity(
  workspaceId: string,
  entityType: ActivityEvent['entityType'],
  entityId: string,
  action: string,
  summary: string,
): Promise<void> {
  try {
    await db.activityEvents.put({
      id: uid('act'),
      workspaceId,
      entityType,
      entityId,
      action,
      summary,
      createdAt: Date.now(),
    });
  } catch {
    // Non-fatal logging failure
  }
}

export async function createNote(params: {
  workspaceId: string;
  folderId?: string | null;
  title?: string;
  contentHtml?: string;
  tags?: string[];
  templateId?: string;
  isDailyNote?: boolean;
  dailyDate?: string | null;
}): Promise<Note> {
  const now = Date.now();
  const todayIso = params.dailyDate ?? getTodayIsoDate(new Date(now));
  const template = params.templateId
    ? NOTE_TEMPLATES.find((t) => t.id === params.templateId)
    : undefined;

  const rawTitle =
    params.title ??
    (template ? template.titlePattern.replaceAll('{{date}}', todayIso) : 'Untitled Note');
  const rawHtml =
    params.contentHtml ??
    (template ? template.contentHtml.replaceAll('{{date}}', todayIso) : '<p></p>');

  const contentText = htmlToPlainText(rawHtml);
  const stats = computeWritingStats(contentText);
  const combinedTags = Array.from(
    new Set([
      ...(params.tags ?? []),
      ...(template?.tags ?? []),
      ...extractInlineHashtags(contentText),
    ]),
  );

  const note: Note = {
    id: uid('note'),
    workspaceId: params.workspaceId,
    folderId: params.folderId ?? null,
    title: rawTitle,
    contentHtml: rawHtml,
    contentText,
    tags: combinedTags,
    wikilinks: extractWikilinks(`${rawTitle}\n${contentText}`),
    isPinned: false,
    isFavorite: false,
    isArchived: false,
    isDailyNote: Boolean(params.isDailyNote),
    dailyDate: params.isDailyNote ? todayIso : null,
    templateName: template?.name ?? null,
    wordCount: stats.words,
    charCount: stats.characters,
    createdAt: now,
    updatedAt: now,
  };

  await db.notes.put(note);
  await db.noteVersions.put({
    id: uid('ver'),
    noteId: note.id,
    title: note.title,
    contentHtml: note.contentHtml,
    contentText: note.contentText,
    summary: 'Created note',
    createdAt: now,
  });
  await logActivity(note.workspaceId, 'note', note.id, 'Created', `Created note "${note.title}"`);
  return note;
}

export async function updateNoteContent(
  noteId: string,
  updates: {
    title?: string;
    contentHtml?: string;
    tags?: string[];
    folderId?: string | null;
  },
): Promise<void> {
  const existing = await db.notes.get(noteId);
  if (!existing) return;

  const title = updates.title !== undefined ? updates.title : existing.title;
  const contentHtml =
    updates.contentHtml !== undefined ? updates.contentHtml : existing.contentHtml;
  const contentText = htmlToPlainText(contentHtml);
  const stats = computeWritingStats(contentText);
  const inlineTags = extractInlineHashtags(contentText);
  const tags =
    updates.tags !== undefined
      ? updates.tags
      : Array.from(new Set([...existing.tags, ...inlineTags]));

  const next: Note = {
    ...existing,
    title,
    contentHtml,
    contentText,
    tags,
    folderId: updates.folderId !== undefined ? updates.folderId : existing.folderId,
    wikilinks: extractWikilinks(`${title}\n${contentText}`),
    wordCount: stats.words,
    charCount: stats.characters,
    updatedAt: Date.now(),
  };

  await db.notes.put(next);
}

export async function saveNoteSnapshot(
  noteId: string,
  summary: string,
): Promise<NoteVersion | null> {
  const note = await db.notes.get(noteId);
  if (!note) return null;
  const version: NoteVersion = {
    id: uid('ver'),
    noteId: note.id,
    title: note.title,
    contentHtml: note.contentHtml,
    contentText: note.contentText,
    summary: summary.trim() || 'Manual snapshot',
    createdAt: Date.now(),
  };
  await db.noteVersions.put(version);
  await logActivity(
    note.workspaceId,
    'note',
    note.id,
    'Snapshot',
    `Saved version for "${note.title}"`,
  );
  return version;
}

export async function restoreNoteVersion(noteId: string, versionId: string): Promise<void> {
  const version = await db.noteVersions.get(versionId);
  if (!version || version.noteId !== noteId) return;
  await updateNoteContent(noteId, {
    title: version.title,
    contentHtml: version.contentHtml,
  });
  await saveNoteSnapshot(
    noteId,
    `Restored from snapshot (${new Date(version.createdAt).toLocaleString()})`,
  );
}

export async function duplicateNote(noteId: string): Promise<Note | null> {
  const src = await db.notes.get(noteId);
  if (!src) return null;
  return createNote({
    workspaceId: src.workspaceId,
    folderId: src.folderId,
    title: `${src.title} (Copy)`,
    contentHtml: src.contentHtml,
    tags: [...src.tags],
  });
}

export async function toggleNoteFlag(
  noteId: string,
  flag: 'isPinned' | 'isFavorite' | 'isArchived',
): Promise<void> {
  const note = await db.notes.get(noteId);
  if (!note) return;
  const now = Date.now();
  if (flag === 'isPinned') {
    await db.notes.update(noteId, { isPinned: !note.isPinned, updatedAt: now });
  } else if (flag === 'isFavorite') {
    await db.notes.update(noteId, { isFavorite: !note.isFavorite, updatedAt: now });
  } else {
    await db.notes.update(noteId, { isArchived: !note.isArchived, updatedAt: now });
  }
}

export async function deleteNotePermanently(noteId: string): Promise<void> {
  const note = await db.notes.get(noteId);
  await db.transaction('rw', [db.notes, db.noteVersions], async () => {
    await db.notes.delete(noteId);
    await db.noteVersions.where('noteId').equals(noteId).delete();
  });
  if (note) {
    await logActivity(note.workspaceId, 'note', noteId, 'Deleted', `Deleted note "${note.title}"`);
  }
}

export async function openOrCreateDailyNote(workspaceId: string, dateIso: string): Promise<Note> {
  const existing = await db.notes
    .where('dailyDate')
    .equals(dateIso)
    .filter((n) => n.workspaceId === workspaceId && !n.isArchived)
    .first();

  if (existing) {
    return existing;
  }
  return createNote({
    workspaceId,
    templateId: 'tpl-journal',
    isDailyNote: true,
    dailyDate: dateIso,
  });
}

export async function createFolder(
  workspaceId: string,
  name: string,
  parentId: string | null = null,
): Promise<Folder> {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Folder name cannot be empty.');
  }
  const count = await db.folders.where('workspaceId').equals(workspaceId).count();
  const folder: Folder = {
    id: uid('fld'),
    workspaceId,
    parentId,
    name: trimmed,
    order: count + 1,
    createdAt: Date.now(),
  };
  await db.folders.put(folder);
  return folder;
}

export async function deleteFolder(folderId: string): Promise<void> {
  await db.transaction('rw', [db.folders, db.notes], async () => {
    await db.notes.where('folderId').equals(folderId).modify({ folderId: null });
    await db.folders.where('parentId').equals(folderId).modify({ parentId: null });
    await db.folders.delete(folderId);
  });
}

export async function captureToInbox(params: {
  workspaceId: string;
  kind: InboxItemKind;
  title: string;
  content: string;
  url?: string | null;
  language?: string | null;
  attachmentId?: string | null;
  tags?: string[];
}): Promise<InboxItem> {
  const item: InboxItem = {
    id: uid('inb'),
    workspaceId: params.workspaceId,
    kind: params.kind,
    title: params.title.trim() || 'Quick Capture',
    content: params.content.trim(),
    url: params.url?.trim() || null,
    language: params.language ?? null,
    attachmentId: params.attachmentId ?? null,
    tags: params.tags ?? [],
    processed: false,
    convertedTarget: null,
    createdAt: Date.now(),
  };
  await db.inboxItems.put(item);
  await logActivity(
    item.workspaceId,
    'inbox',
    item.id,
    'Captured',
    `Captured "${item.title}" to Inbox`,
  );
  return item;
}

export async function convertInboxItem(
  itemId: string,
  target: 'note' | 'task' | 'bookmark' | 'snippet',
): Promise<{ targetId: string }> {
  const item = await db.inboxItems.get(itemId);
  if (!item) {
    throw new Error('Inbox item not found.');
  }

  let targetId = '';
  if (target === 'note') {
    const body = item.url
      ? `<p>${escapeHtml(item.content)}</p><p><a href="${escapeHtml(item.url)}">${escapeHtml(item.url)}</a></p>`
      : `<p>${escapeHtml(item.content).replaceAll('\n', '</p><p>')}</p>`;
    const created = await createNote({
      workspaceId: item.workspaceId,
      title: item.title,
      contentHtml: `<h1>${escapeHtml(item.title)}</h1>${body}`,
      tags: item.tags,
    });
    targetId = created.id;
  } else if (target === 'task') {
    const created = await createTask({
      workspaceId: item.workspaceId,
      title: item.title,
      description: item.content,
      priority: 'medium',
      dueDate: getTodayIsoDate(),
      tags: item.tags,
    });
    targetId = created.id;
  } else if (target === 'bookmark') {
    const bm: BookmarkItem = {
      id: uid('bmk'),
      workspaceId: item.workspaceId,
      title: item.title,
      url: item.url ?? (item.content.startsWith('http') ? item.content : 'https://example.com'),
      description: item.content,
      tags: item.tags,
      isFavorite: false,
      createdAt: Date.now(),
    };
    await db.bookmarks.put(bm);
    targetId = bm.id;
  } else {
    const sn: CodeSnippet = {
      id: uid('snp'),
      workspaceId: item.workspaceId,
      title: item.title,
      language: item.language ?? 'typescript',
      code: item.content,
      description: 'Converted from Universal Inbox',
      tags: item.tags,
      isFavorite: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await db.snippets.put(sn);
    targetId = sn.id;
  }

  await db.inboxItems.update(itemId, {
    processed: true,
    convertedTarget: `${target}:${targetId}`,
  });
  await logActivity(
    item.workspaceId,
    'inbox',
    itemId,
    'Converted',
    `Converted "${item.title}" into ${target}`,
  );
  return { targetId };
}

export async function createTask(params: {
  workspaceId: string;
  title: string;
  description?: string;
  priority?: TaskPriority;
  dueDate?: string | null;
  reminderAt?: number | null;
  linkedNoteId?: string | null;
  tags?: string[];
}): Promise<TaskItem> {
  const title = params.title.trim();
  if (!title) {
    throw new Error('Task title is required.');
  }
  const now = Date.now();
  const task: TaskItem = {
    id: uid('tsk'),
    workspaceId: params.workspaceId,
    title,
    description: params.description?.trim() ?? '',
    completed: false,
    priority: params.priority ?? 'medium',
    dueDate: params.dueDate ?? null,
    reminderAt: params.reminderAt ?? null,
    subtasks: [],
    linkedNoteId: params.linkedNoteId ?? null,
    tags: params.tags ?? [],
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  };
  await db.tasks.put(task);
  await logActivity(task.workspaceId, 'task', task.id, 'Created', `Created task "${task.title}"`);
  return task;
}

export async function toggleTaskComplete(taskId: string): Promise<void> {
  const task = await db.tasks.get(taskId);
  if (!task) return;
  const completed = !task.completed;
  await db.tasks.update(taskId, {
    completed,
    completedAt: completed ? Date.now() : null,
    updatedAt: Date.now(),
  });
  await logActivity(
    task.workspaceId,
    'task',
    task.id,
    completed ? 'Completed' : 'Reopened',
    `${completed ? 'Completed' : 'Reopened'} task "${task.title}"`,
  );
}

export async function addSubtask(taskId: string, title: string): Promise<void> {
  const task = await db.tasks.get(taskId);
  const trimmed = title.trim();
  if (!task || !trimmed) return;
  await db.tasks.update(taskId, {
    subtasks: [...task.subtasks, { id: uid('sub'), title: trimmed, completed: false }],
    updatedAt: Date.now(),
  });
}

export async function toggleSubtask(taskId: string, subtaskId: string): Promise<void> {
  const task = await db.tasks.get(taskId);
  if (!task) return;
  await db.tasks.update(taskId, {
    subtasks: task.subtasks.map((s) =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s,
    ),
    updatedAt: Date.now(),
  });
}

export async function createStructuredCollection(
  workspaceId: string,
  name: string,
  description: string,
  fields: CollectionField[],
): Promise<StructuredCollection> {
  const now = Date.now();
  const collection: StructuredCollection = {
    id: uid('col'),
    workspaceId,
    name: name.trim() || 'Untitled Collection',
    description: description.trim(),
    fields,
    createdAt: now,
    updatedAt: now,
  };
  await db.collections.put(collection);
  await logActivity(
    workspaceId,
    'collection',
    collection.id,
    'Created',
    `Created collection "${collection.name}"`,
  );
  return collection;
}

export async function addCollectionRow(
  collectionId: string,
  workspaceId: string,
  values: Record<string, CollectionCellValue>,
): Promise<CollectionRow> {
  const now = Date.now();
  const row: CollectionRow = {
    id: uid('row'),
    collectionId,
    workspaceId,
    values,
    createdAt: now,
    updatedAt: now,
  };
  await db.collectionRows.put(row);
  return row;
}

export async function storeAttachmentFile(
  workspaceId: string,
  file: File,
  extractedText = '',
  linkedNoteId: string | null = null,
): Promise<AttachmentRecord> {
  const record: AttachmentRecord = {
    id: uid('att'),
    workspaceId,
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
    blob: file,
    extractedText,
    linkedNoteId,
    createdAt: Date.now(),
  };
  await db.attachments.put(record);
  await logActivity(
    workspaceId,
    'attachment',
    record.id,
    'Uploaded',
    `Stored file "${file.name}" locally`,
  );
  return record;
}

export async function addPdfAnnotation(params: {
  attachmentId: string;
  workspaceId: string;
  pageNumber: number;
  kind: PdfAnnotation['kind'];
  color: PdfAnnotation['color'];
  excerpt: string;
  comment: string;
}): Promise<PdfAnnotation> {
  const ann: PdfAnnotation = {
    id: uid('ann'),
    ...params,
    createdAt: Date.now(),
  };
  await db.pdfAnnotations.put(ann);
  return ann;
}

export async function createSmartCollection(
  name: string,
  description: string,
  rule: SmartCollection['rule'],
): Promise<SmartCollection> {
  const item: SmartCollection = {
    id: uid('smt'),
    name: name.trim() || 'Smart Collection',
    description: description.trim(),
    rule,
    createdAt: Date.now(),
  };
  await db.smartCollections.put(item);
  return item;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
