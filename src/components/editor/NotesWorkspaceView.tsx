import { useLiveQuery } from 'dexie-react-hooks';
import {
  Archive,
  ChevronRight,
  FilePlus2,
  FileText,
  Folder as FolderIcon,
  FolderPlus,
  LayoutTemplate,
  Pin,
  Plus,
  Star,
  Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import { createFolder, createNote, deleteFolder } from '../../db/actions';
import { db } from '../../db/database';
import { useUIStore } from '../../store/useUIStore';
import { NoteEditor } from './NoteEditor';

interface NotesWorkspaceViewProps {
  onOpenTemplates: () => void;
}

export function NotesWorkspaceView({ onOpenTemplates }: NotesWorkspaceViewProps) {
  const {
    activeWorkspaceId,
    selectedNoteId,
    selectedFolderId,
    focusMode,
    setSelectedNoteId,
    setSelectedFolderId,
    showToast,
  } = useUIStore();

  const [noteFilter, setNoteFilter] = useState<'active' | 'pinned' | 'favorites' | 'archived'>(
    'active',
  );
  const [folderPopoverOpen, setFolderPopoverOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [searchNotes, setSearchNotes] = useState('');

  const folders = useLiveQuery(
    () => db.folders.where('workspaceId').equals(activeWorkspaceId).sortBy('order'),
    [activeWorkspaceId],
    [],
  );
  const notes = useLiveQuery(
    () => db.notes.where('workspaceId').equals(activeWorkspaceId).toArray(),
    [activeWorkspaceId],
    [],
  );

  const filteredNotes = notes
    .filter((note) => {
      if (noteFilter === 'archived') {
        if (!note.isArchived) return false;
      } else {
        if (note.isArchived) return false;
        if (noteFilter === 'pinned' && !note.isPinned) return false;
        if (noteFilter === 'favorites' && !note.isFavorite) return false;
        if (
          noteFilter === 'active' &&
          selectedFolderId !== null &&
          note.folderId !== selectedFolderId
        ) {
          return false;
        }
      }
      if (searchNotes.trim()) {
        const q = searchNotes.trim().toLowerCase();
        return (
          note.title.toLowerCase().includes(q) ||
          note.contentText.toLowerCase().includes(q) ||
          note.tags.some((t) => t.toLowerCase().includes(q))
        );
      }
      return true;
    })
    .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || b.updatedAt - a.updatedAt);

  async function handleNewNote() {
    const created = await createNote({
      workspaceId: activeWorkspaceId,
      folderId: selectedFolderId,
      title: 'Untitled Note',
    });
    setSelectedNoteId(created.id);
    showToast('Created new note');
  }

  async function handleCreateFolderSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    await createFolder(activeWorkspaceId, newFolderName, null);
    setNewFolderName('');
    setFolderPopoverOpen(false);
    showToast('Folder created');
  }

  return (
    <div className="flex min-w-0 flex-1 overflow-hidden">
      {/* Notes List: Full-screen on mobile when no note is open; frosted side column on desktop */}
      {!focusMode && (
        <section
          aria-label="Notes and folders"
          className={`${
            selectedNoteId ? 'hidden lg:flex' : 'flex'
          } w-full flex-col overflow-y-auto border-r border-border/70 content-pb-mobile lg:w-80 lg:shrink-0 lg:bg-card/35 lg:backdrop-blur-xl lg:pb-6`}
        >
          <div className="mx-auto w-full max-w-2xl space-y-3 p-3.5 sm:p-5 lg:max-w-none">
            {/* Simple Header */}
            <div className="flex items-center justify-between gap-2">
              <h1 className="font-display text-lg font-bold tracking-tight text-foreground sm:text-xl lg:text-base">
                Notes
              </h1>
              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={onOpenTemplates}
                  aria-label="New note from template"
                  className="min-h-[38px] gap-1.5 rounded-xl bg-card/55 px-2.5 text-xs text-muted-foreground"
                >
                  <LayoutTemplate className="h-3.5 w-3.5 text-primary" />
                  <span className="hidden xs:inline sm:inline">Templates</span>
                </Button>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => void handleNewNote()}
                  aria-label="New blank note"
                  className="min-h-[38px] gap-1 rounded-xl px-3 text-xs font-semibold"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New
                </Button>
              </div>
            </div>

            {/* Search Input */}
            <Input
              type="search"
              value={searchNotes}
              onChange={(e) => setSearchNotes(e.target.value)}
              placeholder="Search your notes..."
              aria-label="Filter notes"
              className="h-[42px] rounded-xl bg-card/55 px-3.5 text-sm backdrop-blur-md"
            />

            {/* Filter & Folder Swipe Strip + Popover New Folder */}
            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1">
              <Button
                type="button"
                variant={
                  selectedFolderId === null && noteFilter === 'active' ? 'default' : 'outline'
                }
                size="sm"
                onClick={() => {
                  setSelectedFolderId(null);
                  setNoteFilter('active');
                }}
                className={`min-h-[36px] shrink-0 rounded-xl px-3 text-xs ${
                  selectedFolderId === null && noteFilter === 'active'
                    ? 'font-semibold'
                    : 'bg-card/50 text-muted-foreground'
                }`}
              >
                All
              </Button>
              <Button
                type="button"
                variant={noteFilter === 'pinned' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setNoteFilter('pinned')}
                className={`min-h-[36px] shrink-0 rounded-xl px-3 text-xs ${
                  noteFilter === 'pinned' ? 'font-semibold' : 'bg-card/50 text-muted-foreground'
                }`}
              >
                Pinned
              </Button>
              <Button
                type="button"
                variant={noteFilter === 'favorites' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setNoteFilter('favorites')}
                className={`min-h-[36px] shrink-0 rounded-xl px-3 text-xs ${
                  noteFilter === 'favorites' ? 'font-semibold' : 'bg-card/50 text-muted-foreground'
                }`}
              >
                Starred
              </Button>

              {folders.map((folder) => {
                const isSelected = selectedFolderId === folder.id && noteFilter === 'active';
                return (
                  <div key={folder.id} className="flex shrink-0 items-center">
                    <Button
                      type="button"
                      variant={isSelected ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => {
                        setSelectedFolderId(folder.id);
                        setNoteFilter('active');
                      }}
                      className={`min-h-[36px] gap-1.5 rounded-xl px-3 text-xs ${
                        isSelected
                          ? 'border-primary/60 text-foreground'
                          : 'bg-card/50 text-muted-foreground'
                      }`}
                    >
                      <FolderIcon className="h-3.5 w-3.5 text-primary" />
                      <span>{folder.name}</span>
                    </Button>
                    {isSelected && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => {
                          setSelectedFolderId(null);
                          void deleteFolder(folder.id);
                        }}
                        aria-label={`Delete folder ${folder.name}`}
                        className="ml-0.5 min-h-[36px] min-w-[36px] rounded-lg text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                );
              })}

              <Button
                type="button"
                variant={noteFilter === 'archived' ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setNoteFilter('archived')}
                className={`min-h-[36px] shrink-0 rounded-xl px-3 text-xs ${
                  noteFilter === 'archived'
                    ? 'border-primary/60 text-foreground'
                    : 'bg-card/50 text-muted-foreground'
                }`}
              >
                Archive
              </Button>

              <Popover open={folderPopoverOpen} onOpenChange={setFolderPopoverOpen}>
                <PopoverTrigger
                  render={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      aria-label="New folder"
                      className="min-h-[36px] shrink-0 gap-1 rounded-xl border-dashed bg-transparent px-2.5 text-xs text-muted-foreground"
                    />
                  }
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                  Folder
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64">
                  <PopoverHeader>
                    <PopoverTitle className="text-xs font-semibold">Create Folder</PopoverTitle>
                  </PopoverHeader>
                  <form onSubmit={(e) => void handleCreateFolderSubmit(e)} className="flex gap-2">
                    <Input
                      type="text"
                      value={newFolderName}
                      onChange={(e) => setNewFolderName(e.target.value)}
                      placeholder="Folder name..."
                      aria-label="New folder name"
                      autoFocus
                      className="h-9 flex-1 rounded-lg text-xs"
                    />
                    <Button type="submit" size="sm" className="h-9 rounded-lg px-3 text-xs">
                      Add
                    </Button>
                  </form>
                </PopoverContent>
              </Popover>
            </div>

            {/* Clean Notes List */}
            {filteredNotes.length === 0 ? (
              <Card className="p-8 text-center">
                <FileText className="mx-auto h-7 w-7 text-muted-foreground" />
                <p className="mt-2.5 text-sm font-medium text-foreground">No notes here yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Tap &ldquo;New&rdquo; to start writing a note or checklist.
                </p>
                <Button
                  type="button"
                  onClick={() => void handleNewNote()}
                  className="mx-auto mt-4 min-h-[42px] gap-1.5 rounded-xl px-4 text-xs font-semibold"
                >
                  <FilePlus2 className="h-3.5 w-3.5" />
                  Create Note
                </Button>
              </Card>
            ) : (
              <Card className="gap-0 divide-y divide-border/60 py-0">
                {filteredNotes.map((note) => {
                  const isSelected = selectedNoteId === note.id;
                  const preview = note.contentText.trim().slice(0, 68);
                  return (
                    <button
                      key={note.id}
                      type="button"
                      onClick={() => setSelectedNoteId(note.id)}
                      className={`flex min-h-[64px] w-full items-center gap-2.5 px-3.5 py-3 text-left transition-colors sm:gap-3 sm:px-4 active:bg-muted/60 ${
                        isSelected ? 'bg-secondary/70' : 'hover:bg-muted/40'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-foreground">
                            {note.title || 'Untitled Note'}
                          </span>
                          {note.isPinned && <Pin className="h-3 w-3 shrink-0 text-primary" />}
                          {note.isFavorite && <Star className="h-3 w-3 shrink-0 text-primary" />}
                          {note.isArchived && (
                            <Archive className="h-3 w-3 shrink-0 text-muted-foreground" />
                          )}
                        </div>
                        <div className="mt-0.5 truncate text-xs text-muted-foreground">
                          {preview || new Date(note.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground lg:hidden" />
                    </button>
                  );
                })}
              </Card>
            )}
          </div>
        </section>
      )}

      {/* Editor Canvas */}
      <div
        className={`${selectedNoteId ? 'flex' : 'hidden lg:flex'} min-w-0 flex-1 overflow-hidden`}
      >
        <NoteEditor onOpenTemplates={onOpenTemplates} />
      </div>
    </div>
  );
}
