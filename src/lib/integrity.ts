import type {
  AttachmentRecord,
  CollectionRow,
  Folder,
  Note,
  StructuredCollection,
  TaskItem,
  Workspace,
} from '../types/workspace';
import {
  type BrokenLinkIssue,
  type DuplicateNoteGroup,
  detectBrokenLinks,
  detectDuplicateNotes,
  detectOrphanNotes,
} from './links';

export interface IntegrityReport {
  checkedAt: number;
  brokenLinks: BrokenLinkIssue[];
  orphanNotes: Array<{ id: string; title: string; workspaceId: string }>;
  duplicateGroups: DuplicateNoteGroup[];
  danglingFolders: Array<{ noteId: string; noteTitle: string; folderId: string }>;
  danglingTaskNotes: Array<{ taskId: string; taskTitle: string; noteId: string }>;
  emptyAttachments: Array<{ id: string; name: string }>;
  danglingCollectionRows: Array<{ rowId: string; collectionId: string }>;
  invalidWorkspaceRefs: number;
  totalIssues: number;
}

export function runIntegrityAudit(snapshot: {
  workspaces: Workspace[];
  folders: Folder[];
  notes: Note[];
  tasks: TaskItem[];
  collections: StructuredCollection[];
  collectionRows: CollectionRow[];
  attachments: AttachmentRecord[];
}): IntegrityReport {
  const workspaceIds = new Set(snapshot.workspaces.map((w) => w.id));
  const folderIds = new Set(snapshot.folders.map((f) => f.id));
  const noteIds = new Set(snapshot.notes.map((n) => n.id));
  const collectionIds = new Set(snapshot.collections.map((c) => c.id));

  const brokenLinks = detectBrokenLinks(snapshot.notes);
  const orphanNotes = detectOrphanNotes(snapshot.notes).map((n) => ({
    id: n.id,
    title: n.title,
    workspaceId: n.workspaceId,
  }));
  const duplicateGroups = detectDuplicateNotes(snapshot.notes);

  const danglingFolders: IntegrityReport['danglingFolders'] = [];
  for (const note of snapshot.notes) {
    if (note.folderId && !folderIds.has(note.folderId)) {
      danglingFolders.push({
        noteId: note.id,
        noteTitle: note.title,
        folderId: note.folderId,
      });
    }
  }

  const danglingTaskNotes: IntegrityReport['danglingTaskNotes'] = [];
  for (const task of snapshot.tasks) {
    if (task.linkedNoteId && !noteIds.has(task.linkedNoteId)) {
      danglingTaskNotes.push({
        taskId: task.id,
        taskTitle: task.title,
        noteId: task.linkedNoteId,
      });
    }
  }

  const emptyAttachments = snapshot.attachments
    .filter((a) => a.size <= 0)
    .map((a) => ({ id: a.id, name: a.name }));

  const danglingCollectionRows = snapshot.collectionRows
    .filter((r) => !collectionIds.has(r.collectionId))
    .map((r) => ({ rowId: r.id, collectionId: r.collectionId }));

  let invalidWorkspaceRefs = 0;
  for (const note of snapshot.notes) {
    if (!workspaceIds.has(note.workspaceId)) invalidWorkspaceRefs += 1;
  }
  for (const task of snapshot.tasks) {
    if (!workspaceIds.has(task.workspaceId)) invalidWorkspaceRefs += 1;
  }

  const totalIssues =
    brokenLinks.length +
    duplicateGroups.length +
    danglingFolders.length +
    danglingTaskNotes.length +
    emptyAttachments.length +
    danglingCollectionRows.length +
    invalidWorkspaceRefs;

  return {
    checkedAt: Date.now(),
    brokenLinks,
    orphanNotes,
    duplicateGroups,
    danglingFolders,
    danglingTaskNotes,
    emptyAttachments,
    danglingCollectionRows,
    invalidWorkspaceRefs,
    totalIssues,
  };
}
