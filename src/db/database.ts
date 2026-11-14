import Dexie, { type Table } from 'dexie';
import type {
  ActivityEvent,
  AttachmentRecord,
  BookmarkItem,
  ClipboardEntry,
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

export class FolioDatabase extends Dexie {
  workspaces!: Table<Workspace, string>;
  folders!: Table<Folder, string>;
  notes!: Table<Note, string>;
  noteVersions!: Table<NoteVersion, string>;
  inboxItems!: Table<InboxItem, string>;
  tasks!: Table<TaskItem, string>;
  collections!: Table<StructuredCollection, string>;
  collectionRows!: Table<CollectionRow, string>;
  attachments!: Table<AttachmentRecord, string>;
  pdfAnnotations!: Table<PdfAnnotation, string>;
  snippets!: Table<CodeSnippet, string>;
  bookmarks!: Table<BookmarkItem, string>;
  clipboardEntries!: Table<ClipboardEntry, string>;
  smartCollections!: Table<SmartCollection, string>;
  savedSearches!: Table<SavedSearch, string>;
  activityEvents!: Table<ActivityEvent, string>;

  constructor() {
    super('folio_local_workspace_v1');
    this.version(1).stores({
      workspaces: 'id, name, createdAt',
      folders: 'id, workspaceId, parentId, order',
      notes:
        'id, workspaceId, folderId, title, isPinned, isFavorite, isArchived, isDailyNote, dailyDate, updatedAt, *tags',
      noteVersions: 'id, noteId, createdAt',
      inboxItems: 'id, workspaceId, kind, processed, createdAt',
      tasks: 'id, workspaceId, completed, priority, dueDate, linkedNoteId, updatedAt',
      collections: 'id, workspaceId, name, updatedAt',
      collectionRows: 'id, collectionId, workspaceId, updatedAt',
      attachments: 'id, workspaceId, mimeType, linkedNoteId, createdAt',
      pdfAnnotations: 'id, attachmentId, workspaceId, pageNumber, kind, createdAt',
      snippets: 'id, workspaceId, language, isFavorite, updatedAt, *tags',
      bookmarks: 'id, workspaceId, isFavorite, createdAt, *tags',
      clipboardEntries: 'id, kind, pinned, createdAt',
      smartCollections: 'id, name, createdAt',
      savedSearches: 'id, name, createdAt',
      activityEvents: 'id, workspaceId, entityType, createdAt',
    });
  }
}

export const db = new FolioDatabase();
