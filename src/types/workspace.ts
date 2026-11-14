export type WorkspaceView =
  | 'home'
  | 'notes'
  | 'inbox'
  | 'tasks'
  | 'calendar'
  | 'search'
  | 'graph'
  | 'collections'
  | 'pdf'
  | 'snippets'
  | 'vault';

export type ThemeMode = 'light' | 'dark';

export type InspectorTab = 'links' | 'outline' | 'versions' | 'stats';

export interface Workspace {
  id: string;
  name: string;
  description: string;
  accent: string;
  createdAt: number;
}

export interface Folder {
  id: string;
  workspaceId: string;
  parentId: string | null;
  name: string;
  order: number;
  createdAt: number;
}

export interface Note {
  id: string;
  workspaceId: string;
  folderId: string | null;
  title: string;
  contentHtml: string;
  contentText: string;
  tags: string[];
  wikilinks: string[];
  isPinned: boolean;
  isFavorite: boolean;
  isArchived: boolean;
  isDailyNote: boolean;
  dailyDate: string | null; // YYYY-MM-DD
  templateName: string | null;
  wordCount: number;
  charCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface NoteVersion {
  id: string;
  noteId: string;
  title: string;
  contentHtml: string;
  contentText: string;
  summary: string;
  createdAt: number;
}

export type InboxItemKind = 'text' | 'idea' | 'link' | 'task' | 'code' | 'image' | 'file';

export interface InboxItem {
  id: string;
  workspaceId: string;
  kind: InboxItemKind;
  title: string;
  content: string;
  url: string | null;
  language: string | null;
  attachmentId: string | null;
  tags: string[];
  processed: boolean;
  convertedTarget: string | null;
  createdAt: number;
}

export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';

export interface SubTask {
  id: string;
  title: string;
  completed: boolean;
}

export interface TaskItem {
  id: string;
  workspaceId: string;
  title: string;
  description: string;
  completed: boolean;
  priority: TaskPriority;
  dueDate: string | null; // YYYY-MM-DD
  reminderAt: number | null;
  subtasks: SubTask[];
  linkedNoteId: string | null;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
}

export type CollectionFieldType = 'text' | 'number' | 'select' | 'date' | 'checkbox' | 'url';

export interface CollectionField {
  id: string;
  name: string;
  type: CollectionFieldType;
  options?: string[];
}

export type CollectionCellValue = string | number | boolean | null;

export interface StructuredCollection {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  fields: CollectionField[];
  createdAt: number;
  updatedAt: number;
}

export interface CollectionRow {
  id: string;
  collectionId: string;
  workspaceId: string;
  values: Record<string, CollectionCellValue>;
  createdAt: number;
  updatedAt: number;
}

export interface AttachmentRecord {
  id: string;
  workspaceId: string;
  name: string;
  mimeType: string;
  size: number;
  blob: Blob;
  extractedText: string;
  linkedNoteId: string | null;
  createdAt: number;
}

export interface PdfAnnotation {
  id: string;
  attachmentId: string;
  workspaceId: string;
  pageNumber: number;
  kind: 'highlight' | 'bookmark' | 'note';
  color: 'amber' | 'cobalt' | 'emerald' | 'rose';
  excerpt: string;
  comment: string;
  createdAt: number;
}

export interface CodeSnippet {
  id: string;
  workspaceId: string;
  title: string;
  language: string;
  code: string;
  description: string;
  tags: string[];
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface BookmarkItem {
  id: string;
  workspaceId: string;
  title: string;
  url: string;
  description: string;
  tags: string[];
  isFavorite: boolean;
  createdAt: number;
}

export interface ClipboardEntry {
  id: string;
  content: string;
  kind: 'text' | 'url' | 'code';
  pinned: boolean;
  createdAt: number;
}

export interface SmartCollectionRule {
  workspaceId?: string | 'all';
  tag?: string;
  pinnedOnly?: boolean;
  favoriteOnly?: boolean;
  includeArchived?: boolean;
  hasWikilinks?: boolean;
  updatedWithinDays?: number;
  queryText?: string;
}

export interface SmartCollection {
  id: string;
  name: string;
  description: string;
  rule: SmartCollectionRule;
  createdAt: number;
}

export interface SavedSearch {
  id: string;
  name: string;
  query: string;
  entityFilter: 'all' | 'notes' | 'tasks' | 'bookmarks' | 'snippets' | 'attachments';
  tagFilter: string;
  workspaceId: string | 'all';
  createdAt: number;
}

export interface ActivityEvent {
  id: string;
  workspaceId: string;
  entityType:
    | 'note'
    | 'task'
    | 'inbox'
    | 'collection'
    | 'attachment'
    | 'snippet'
    | 'bookmark'
    | 'vault';
  entityId: string;
  action: string;
  summary: string;
  createdAt: number;
}

export interface NoteTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  titlePattern: string;
  contentHtml: string;
}
