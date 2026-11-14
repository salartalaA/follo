import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useLiveQuery } from 'dexie-react-hooks';
import { common, createLowlight } from 'lowlight';
import {
  Archive,
  Bold,
  CheckSquare,
  Code,
  Copy,
  Heading1,
  Heading2,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  MoreHorizontal,
  Pin,
  Plus,
  Quote,
  SlidersHorizontal,
  Star,
  Table as TableIcon,
  Trash2,
  Type,
  X,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  createNote,
  deleteNotePermanently,
  duplicateNote,
  toggleNoteFlag,
  updateNoteContent,
} from '../../db/actions';
import { db } from '../../db/database';
import { useUIStore } from '../../store/useUIStore';
import type { Note } from '../../types/workspace';
import { InspectorDrawer } from './InspectorDrawer';

const lowlight = createLowlight(common);

interface NoteEditorProps {
  onOpenTemplates: () => void;
}

export function NoteEditor({ onOpenTemplates }: NoteEditorProps) {
  const {
    activeWorkspaceId,
    selectedNoteId,
    readingMode,
    serifMode,
    inspectorOpen,
    setSelectedNoteId,
    setInspectorOpen,
    toggleSerifMode,
    showToast,
  } = useUIStore();

  const note = useLiveQuery(
    () => (selectedNoteId ? db.notes.get(selectedNoteId) : undefined),
    [selectedNoteId],
  );
  const allNotes = useLiveQuery(() => db.notes.toArray(), [], []);
  const folders = useLiveQuery(
    () => db.folders.where('workspaceId').equals(activeWorkspaceId).sortBy('order'),
    [activeWorkspaceId],
    [],
  );

  const [titleInput, setTitleInput] = useState('');
  const [newTagInput, setNewTagInput] = useState('');
  const [tagPopoverOpen, setTagPopoverOpen] = useState(false);
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [moreFormatOpen, setMoreFormatOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const saveTimerRef = useRef<number | null>(null);
  const activeNoteIdRef = useRef<string | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        link: {
          openOnClick: true,
          autolink: true,
        },
      }),
      CodeBlockLowlight.configure({
        lowlight,
      }),
      TaskList,
      TaskItem.configure({
        nested: true,
      }),
      Table.configure({
        resizable: false,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({
        inline: false,
      }),
      Placeholder.configure({
        placeholder: 'Start writing, add a checklist, or type [[Note Title]]...',
      }),
    ],
    content: note?.contentHtml ?? '<p></p>',
    editable: !readingMode,
    editorProps: {
      attributes: {
        class: `folio-prose min-h-[380px] ${serifMode ? 'font-serif-reading' : ''}`,
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const targetId = activeNoteIdRef.current;
      if (!targetId) return;
      const html = currentEditor.getHTML();
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current);
      }
      saveTimerRef.current = window.setTimeout(() => {
        void updateNoteContent(targetId, { contentHtml: html });
      }, 220);
    },
  });

  useEffect(() => {
    if (!note) return;
    setConfirmDelete(false);
    setLinkPickerOpen(false);
    setTagPopoverOpen(false);
    if (activeNoteIdRef.current !== note.id) {
      activeNoteIdRef.current = note.id;
      setTitleInput(note.title);
      if (editor && editor.getHTML() !== note.contentHtml) {
        editor.commands.setContent(note.contentHtml, { emitUpdate: false });
      }
    }
  }, [note, editor]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readingMode);
    editor.setOptions({
      editorProps: {
        attributes: {
          class: `folio-prose min-h-[380px] ${serifMode ? 'font-serif-reading' : ''}`,
        },
      },
    });
  }, [editor, readingMode, serifMode]);

  if (!note) {
    return (
      <div className="flex flex-1 items-center justify-center p-8">
        <div className="max-w-md text-center">
          <h2 className="font-display text-lg font-semibold text-foreground">
            Pick a note to start reading or writing
          </h2>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Everything saves automatically right on your device.
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
            <Button
              type="button"
              onClick={async () => {
                const created = await createNote({
                  workspaceId: activeWorkspaceId,
                  title: 'Untitled Note',
                });
                setSelectedNoteId(created.id);
              }}
              className="min-h-[44px] rounded-xl px-4 text-xs font-semibold"
            >
              New Note
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onOpenTemplates}
              className="min-h-[44px] rounded-xl bg-card/55 px-4 text-xs font-medium"
            >
              Templates
            </Button>
          </div>
        </div>
      </div>
    );
  }

  function handleTitleChange(nextTitle: string) {
    setTitleInput(nextTitle);
    const id = note?.id;
    if (!id) return;
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      void updateNoteContent(id, { title: nextTitle });
    }, 200);
  }

  async function handleAddTag(e: React.FormEvent) {
    e.preventDefault();
    if (!note) return;
    const cleaned = newTagInput.trim().toLowerCase().replace(/^#/, '');
    if (!cleaned) return;
    if (!note.tags.includes(cleaned)) {
      await updateNoteContent(note.id, { tags: [...note.tags, cleaned] });
    }
    setNewTagInput('');
    setTagPopoverOpen(false);
  }

  async function handleRemoveTag(tagToRemove: string) {
    if (!note) return;
    await updateNoteContent(note.id, {
      tags: note.tags.filter((t) => t !== tagToRemove),
    });
  }

  function handleInsertImage(file: File) {
    if (!editor) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        editor.chain().focus().setImage({ src: reader.result, alt: file.name }).run();
      }
    };
    reader.readAsDataURL(file);
  }

  function handleInsertWikilink(targetNote: Note) {
    if (!editor) return;
    editor.chain().focus().insertContent(`[[${targetNote.title}]] `).run();
    setLinkPickerOpen(false);
  }

  const linkableNotes = allNotes.filter((n) => n.id !== note.id && !n.isArchived);
  const currentFolderName = folders.find((f) => f.id === note.folderId)?.name ?? 'Unfiled';

  return (
    <div className="flex min-w-0 flex-1 overflow-hidden">
      {/* Main Document Canvas */}
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto pb-24 md:pb-8">
        {/* Everyday Compact Frosted Formatting Bar */}
        {!readingMode && (
          <div className="glass-bar sticky top-0 z-10 border-b border-border/70 px-3 py-1.5 sm:px-5">
            <div className="flex items-center justify-between gap-2">
              <div className="no-scrollbar flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
                <ToolbarBtn
                  label="Checklist"
                  active={editor?.isActive('taskList')}
                  onClick={() => editor?.chain().focus().toggleTaskList().run()}
                >
                  <CheckSquare className="h-4 w-4" />
                </ToolbarBtn>
                <ToolbarBtn
                  label="Heading"
                  active={editor?.isActive('heading', { level: 1 })}
                  onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
                >
                  <Heading1 className="h-4 w-4" />
                </ToolbarBtn>
                <ToolbarBtn
                  label="Bold"
                  active={editor?.isActive('bold')}
                  onClick={() => editor?.chain().focus().toggleBold().run()}
                >
                  <Bold className="h-4 w-4" />
                </ToolbarBtn>
                <ToolbarBtn
                  label="Bullet List"
                  active={editor?.isActive('bulletList')}
                  onClick={() => editor?.chain().focus().toggleBulletList().run()}
                >
                  <List className="h-4 w-4" />
                </ToolbarBtn>

                <label
                  title="Add Photo"
                  className="flex min-h-[40px] min-w-[40px] shrink-0 cursor-pointer items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ImagePlus className="h-4 w-4" />
                  <input
                    type="file"
                    accept="image/*"
                    aria-label="Insert image into note"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleInsertImage(f);
                    }}
                  />
                </label>

                <Button
                  type="button"
                  variant={moreFormatOpen ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setMoreFormatOpen((prev) => !prev)}
                  aria-expanded={moreFormatOpen}
                  className={`min-h-[36px] shrink-0 rounded-lg px-2.5 text-xs font-medium ${
                    moreFormatOpen ? 'text-primary' : 'text-muted-foreground'
                  }`}
                >
                  {moreFormatOpen ? 'Less' : 'More'}
                </Button>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <ToolbarBtn
                  label={note.isPinned ? 'Unpin note' : 'Pin note'}
                  active={note.isPinned}
                  onClick={() => void toggleNoteFlag(note.id, 'isPinned')}
                >
                  <Pin className="h-4 w-4" />
                </ToolbarBtn>

                <DropdownMenu onOpenChange={(open) => !open && setConfirmDelete(false)}>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Note actions and options"
                        className="min-h-[40px] min-w-[40px] rounded-lg text-muted-foreground"
                      />
                    }
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={() => setInspectorOpen(!inspectorOpen)}>
                      <SlidersHorizontal className="h-4 w-4 text-primary" />
                      Links, History & Export
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={toggleSerifMode}>
                      <Type className="h-4 w-4 text-primary" />
                      {serifMode ? 'Use Sans Font' : 'Use Serif Reading Font'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => void toggleNoteFlag(note.id, 'isFavorite')}>
                      <Star className="h-4 w-4 text-primary" />
                      {note.isFavorite ? 'Remove from Starred' : 'Add to Starred'}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={async () => {
                        const copy = await duplicateNote(note.id);
                        if (copy) {
                          setSelectedNoteId(copy.id);
                          showToast('Duplicated note');
                        }
                      }}
                    >
                      <Copy className="h-4 w-4 text-primary" />
                      Duplicate Note
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => {
                        void toggleNoteFlag(note.id, 'isArchived');
                        showToast(note.isArchived ? 'Restored from archive' : 'Archived note');
                      }}
                    >
                      <Archive className="h-4 w-4 text-muted-foreground" />
                      {note.isArchived ? 'Unarchive Note' : 'Archive Note'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {!confirmDelete ? (
                      <DropdownMenuItem
                        variant="destructive"
                        closeOnClick={false}
                        onClick={() => setConfirmDelete(true)}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete Note
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem
                        variant="destructive"
                        onClick={async () => {
                          await deleteNotePermanently(note.id);
                          setSelectedNoteId(null);
                          setConfirmDelete(false);
                          showToast('Deleted note');
                        }}
                        className="bg-destructive/15 font-semibold"
                      >
                        <Trash2 className="h-4 w-4" />
                        Tap again to delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {moreFormatOpen && (
              <div className="no-scrollbar mt-1 flex items-center gap-0.5 overflow-x-auto border-t border-border/60 pt-1">
                <ToolbarBtn
                  label="Subheading"
                  active={editor?.isActive('heading', { level: 2 })}
                  onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
                >
                  <Heading2 className="h-4 w-4" />
                </ToolbarBtn>
                <ToolbarBtn
                  label="Italic"
                  active={editor?.isActive('italic')}
                  onClick={() => editor?.chain().focus().toggleItalic().run()}
                >
                  <Italic className="h-4 w-4" />
                </ToolbarBtn>
                <ToolbarBtn
                  label="Numbered List"
                  active={editor?.isActive('orderedList')}
                  onClick={() => editor?.chain().focus().toggleOrderedList().run()}
                >
                  <ListOrdered className="h-4 w-4" />
                </ToolbarBtn>
                <ToolbarBtn
                  label="Quote"
                  active={editor?.isActive('blockquote')}
                  onClick={() => editor?.chain().focus().toggleBlockquote().run()}
                >
                  <Quote className="h-4 w-4" />
                </ToolbarBtn>
                <ToolbarBtn
                  label="Insert Table"
                  onClick={() =>
                    editor
                      ?.chain()
                      .focus()
                      .insertTable({ rows: 3, cols: 3, withHeaderRow: true })
                      .run()
                  }
                >
                  <TableIcon className="h-4 w-4" />
                </ToolbarBtn>
                <ToolbarBtn
                  label="Code Block"
                  active={editor?.isActive('codeBlock')}
                  onClick={() => editor?.chain().focus().toggleCodeBlock().run()}
                >
                  <Code className="h-4 w-4" />
                </ToolbarBtn>

                <Popover open={linkPickerOpen} onOpenChange={setLinkPickerOpen}>
                  <PopoverTrigger
                    render={
                      <Button
                        type="button"
                        variant={linkPickerOpen ? 'secondary' : 'ghost'}
                        size="icon"
                        aria-label="Link Another Note"
                        title="Link Another Note"
                        className={`min-h-[40px] min-w-[40px] shrink-0 rounded-lg ${
                          linkPickerOpen ? 'text-primary' : 'text-muted-foreground'
                        }`}
                      />
                    }
                  >
                    <Link2 className="h-4 w-4" />
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-72 p-2">
                    <PopoverHeader className="px-2 py-1">
                      <PopoverTitle className="text-xs font-semibold text-muted-foreground">
                        Link to another note
                      </PopoverTitle>
                    </PopoverHeader>
                    <div className="max-h-56 space-y-0.5 overflow-y-auto">
                      {linkableNotes.length === 0 ? (
                        <p className="px-2 py-3 text-xs text-muted-foreground">
                          No other notes to link yet.
                        </p>
                      ) : (
                        linkableNotes.map((target) => (
                          <button
                            key={target.id}
                            type="button"
                            onClick={() => handleInsertWikilink(target)}
                            className="flex min-h-[40px] w-full items-center truncate rounded-lg px-2.5 py-1.5 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted/70"
                          >
                            {target.title}
                          </button>
                        ))
                      )}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            )}
          </div>
        )}

        {/* Glassmorphic Paper Sheet */}
        <article className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-8 sm:py-7">
          <Card className="gap-0 px-4 py-6 sm:px-9 sm:py-8">
            <input
              type="text"
              value={titleInput}
              readOnly={readingMode}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Note title..."
              aria-label="Document title"
              className="w-full bg-transparent font-display text-2xl font-bold tracking-tight text-foreground outline-none placeholder:text-muted-foreground/55 sm:text-3xl"
            />

            {/* Clean Minimal Metadata */}
            <div className="mt-3 space-y-2 border-b border-border/60 pb-4 text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
                <span className="font-mono tabular-nums">
                  {note.wordCount} words · {new Date(note.updatedAt).toLocaleDateString()}
                </span>

                <div className="inline-flex items-center gap-1.5">
                  <span>Folder:</span>
                  <Select
                    value={note.folderId ?? '__unfiled__'}
                    disabled={readingMode}
                    onValueChange={(value) => {
                      if (!value) return;
                      void updateNoteContent(note.id, {
                        folderId: value === '__unfiled__' ? null : value,
                      });
                    }}
                  >
                    <SelectTrigger
                      size="sm"
                      aria-label="Note folder"
                      className="h-7 rounded-lg border-border/60 bg-background/40 px-2 text-xs font-medium text-foreground"
                    >
                      <SelectValue>{currentFolderName}</SelectValue>
                    </SelectTrigger>
                    <SelectContent align="end">
                      <SelectItem value="__unfiled__">Unfiled</SelectItem>
                      {folders.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Inline Tags + Popover Adder */}
              <div className="flex flex-wrap items-center gap-2">
                {note.tags.map((tag) => (
                  <span key={tag} className="inline-flex items-center gap-1 text-primary">
                    <span>#{tag}</span>
                    {!readingMode && (
                      <button
                        type="button"
                        onClick={() => void handleRemoveTag(tag)}
                        aria-label={`Remove tag ${tag}`}
                        className="inline-flex items-center rounded text-muted-foreground hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                ))}
                {!readingMode && (
                  <Popover open={tagPopoverOpen} onOpenChange={setTagPopoverOpen}>
                    <PopoverTrigger
                      render={
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          className="h-6 gap-1 rounded-md px-1.5 text-xs text-muted-foreground"
                        />
                      }
                    >
                      <Plus className="h-3 w-3" />
                      tag
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-56">
                      <form onSubmit={(e) => void handleAddTag(e)} className="flex gap-1.5">
                        <Input
                          type="text"
                          value={newTagInput}
                          onChange={(e) => setNewTagInput(e.target.value)}
                          placeholder="e.g. recipes"
                          aria-label="Add tag to note"
                          autoFocus
                          className="h-8 flex-1 rounded-lg text-xs"
                        />
                        <Button type="submit" size="sm" className="h-8 rounded-lg px-2.5 text-xs">
                          Add
                        </Button>
                      </form>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>

            {/* Tiptap Content */}
            <div className="mt-5">
              <EditorContent editor={editor} />
            </div>
          </Card>
        </article>
      </div>

      {/* Contextual Details & Advanced Tools Drawer */}
      <InspectorDrawer note={note} />
    </div>
  );
}

function ToolbarBtn({
  label,
  active = false,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant={active ? 'secondary' : 'ghost'}
      size="icon"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`min-h-[40px] min-w-[40px] shrink-0 rounded-lg ${
        active ? 'text-primary' : 'text-muted-foreground'
      }`}
    >
      {children}
    </Button>
  );
}
