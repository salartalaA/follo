import type {
  BookmarkItem,
  CodeSnippet,
  CollectionRow,
  Folder,
  InboxItem,
  Note,
  NoteVersion,
  SmartCollection,
  StructuredCollection,
  TaskItem,
  Workspace,
} from '../types/workspace';

export interface WorkspaceBackupPayload {
  schemaVersion: number;
  exportedAt: number;
  app: 'folio';
  workspaces: Workspace[];
  folders: Folder[];
  notes: Note[];
  noteVersions: NoteVersion[];
  inboxItems: InboxItem[];
  tasks: TaskItem[];
  collections: StructuredCollection[];
  collectionRows: CollectionRow[];
  snippets: CodeSnippet[];
  bookmarks: BookmarkItem[];
  smartCollections: SmartCollection[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isValidWorkspace(value: unknown): value is Workspace {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.description === 'string' &&
    typeof value.accent === 'string' &&
    typeof value.createdAt === 'number'
  );
}

function isValidNote(value: unknown): value is Note {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.workspaceId === 'string' &&
    typeof value.title === 'string' &&
    typeof value.contentHtml === 'string' &&
    typeof value.contentText === 'string' &&
    isStringArray(value.tags) &&
    isStringArray(value.wikilinks) &&
    typeof value.createdAt === 'number' &&
    typeof value.updatedAt === 'number'
  );
}

function isValidTask(value: unknown): value is TaskItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    typeof value.workspaceId === 'string' &&
    typeof value.title === 'string' &&
    typeof value.completed === 'boolean' &&
    typeof value.priority === 'string' &&
    Array.isArray(value.subtasks)
  );
}

export function validateBackupPayload(input: unknown): {
  valid: boolean;
  payload: WorkspaceBackupPayload | null;
  errors: string[];
} {
  const errors: string[] = [];
  if (!isRecord(input)) {
    return { valid: false, payload: null, errors: ['Backup file must be a JSON object.'] };
  }

  if (input.app !== 'folio') {
    errors.push('Missing or invalid "app": expected "folio".');
  }
  if (typeof input.schemaVersion !== 'number' || input.schemaVersion < 1) {
    errors.push('Invalid or missing schemaVersion.');
  }
  if (!Array.isArray(input.workspaces) || !input.workspaces.every(isValidWorkspace)) {
    errors.push('Invalid workspaces array.');
  }
  if (!Array.isArray(input.notes) || !input.notes.every(isValidNote)) {
    errors.push('Invalid notes array.');
  }
  if (!Array.isArray(input.tasks) || !input.tasks.every(isValidTask)) {
    errors.push('Invalid tasks array.');
  }

  if (errors.length > 0) {
    return { valid: false, payload: null, errors };
  }

  const payload: WorkspaceBackupPayload = {
    schemaVersion: Number(input.schemaVersion),
    exportedAt: typeof input.exportedAt === 'number' ? input.exportedAt : Date.now(),
    app: 'folio',
    workspaces: input.workspaces as Workspace[],
    folders: Array.isArray(input.folders) ? (input.folders as Folder[]) : [],
    notes: input.notes as Note[],
    noteVersions: Array.isArray(input.noteVersions) ? (input.noteVersions as NoteVersion[]) : [],
    inboxItems: Array.isArray(input.inboxItems) ? (input.inboxItems as InboxItem[]) : [],
    tasks: input.tasks as TaskItem[],
    collections: Array.isArray(input.collections)
      ? (input.collections as StructuredCollection[])
      : [],
    collectionRows: Array.isArray(input.collectionRows)
      ? (input.collectionRows as CollectionRow[])
      : [],
    snippets: Array.isArray(input.snippets) ? (input.snippets as CodeSnippet[]) : [],
    bookmarks: Array.isArray(input.bookmarks) ? (input.bookmarks as BookmarkItem[]) : [],
    smartCollections: Array.isArray(input.smartCollections)
      ? (input.smartCollections as SmartCollection[])
      : [],
  };

  return { valid: true, payload, errors: [] };
}
