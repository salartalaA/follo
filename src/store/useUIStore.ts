import { toast } from 'sonner';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { InspectorTab, ThemeMode, WorkspaceView } from '../types/workspace';

interface UIState {
  theme: ThemeMode;
  activeWorkspaceId: string;
  activeView: WorkspaceView;
  selectedNoteId: string | null;
  selectedFolderId: string | null;
  selectedCollectionId: string | null;
  selectedAttachmentId: string | null;
  noteBrowserOpen: boolean;
  inspectorOpen: boolean;
  inspectorTab: InspectorTab;
  focusMode: boolean;
  readingMode: boolean;
  serifMode: boolean;
  commandPaletteOpen: boolean;
  quickCaptureOpen: boolean;
  moreSheetOpen: boolean;
  toastMessage: string | null;
  dismissedReminderIds: string[];

  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  setActiveWorkspaceId: (id: string) => void;
  setActiveView: (view: WorkspaceView) => void;
  setSelectedNoteId: (id: string | null) => void;
  openNoteInEditor: (id: string) => void;
  setSelectedFolderId: (id: string | null) => void;
  setSelectedCollectionId: (id: string | null) => void;
  setSelectedAttachmentId: (id: string | null) => void;
  setNoteBrowserOpen: (open: boolean) => void;
  setInspectorOpen: (open: boolean) => void;
  setInspectorTab: (tab: InspectorTab) => void;
  toggleFocusMode: () => void;
  toggleReadingMode: () => void;
  toggleSerifMode: () => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setQuickCaptureOpen: (open: boolean) => void;
  setMoreSheetOpen: (open: boolean) => void;
  showToast: (message: string) => void;
  dismissReminder: (taskId: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'dark',
      activeWorkspaceId: 'ws-personal',
      activeView: 'home',
      selectedNoteId: null,
      selectedFolderId: null,
      selectedCollectionId: 'col-reading',
      selectedAttachmentId: 'att-sample-pdf',
      noteBrowserOpen: true,
      inspectorOpen: false,
      inspectorTab: 'links',
      focusMode: false,
      readingMode: false,
      serifMode: false,
      commandPaletteOpen: false,
      quickCaptureOpen: false,
      moreSheetOpen: false,
      toastMessage: null,
      dismissedReminderIds: [],

      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === 'light' ? 'dark' : 'light' })),
      setActiveWorkspaceId: (id) =>
        set({
          activeWorkspaceId: id,
          selectedFolderId: null,
        }),
      setActiveView: (view) => set({ activeView: view, moreSheetOpen: false }),
      setSelectedNoteId: (id) =>
        set({
          selectedNoteId: id,
          activeView: 'notes',
          moreSheetOpen: false,
        }),
      openNoteInEditor: (id) =>
        set({
          selectedNoteId: id,
          activeView: 'notes',
          moreSheetOpen: false,
        }),
      setSelectedFolderId: (id) => set({ selectedFolderId: id }),
      setSelectedCollectionId: (id) => set({ selectedCollectionId: id }),
      setSelectedAttachmentId: (id) => set({ selectedAttachmentId: id }),
      setNoteBrowserOpen: (open) => set({ noteBrowserOpen: open }),
      setInspectorOpen: (open) => set({ inspectorOpen: open }),
      setInspectorTab: (tab) => set({ inspectorTab: tab, inspectorOpen: true }),
      toggleFocusMode: () => set((state) => ({ focusMode: !state.focusMode })),
      toggleReadingMode: () => set((state) => ({ readingMode: !state.readingMode })),
      toggleSerifMode: () => set((state) => ({ serifMode: !state.serifMode })),
      setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),
      setQuickCaptureOpen: (open) => set({ quickCaptureOpen: open, moreSheetOpen: false }),
      setMoreSheetOpen: (open) => set({ moreSheetOpen: open }),
      showToast: (message) => {
        if (message) {
          toast.success(message, { duration: 2400 });
        }
        set({ toastMessage: message || null });
      },
      dismissReminder: (taskId) =>
        set((state) => ({
          dismissedReminderIds: [...state.dismissedReminderIds, taskId],
        })),
    }),
    {
      name: 'folio-ui-state-v2',
      partialize: (state) => ({
        theme: state.theme,
        activeWorkspaceId: state.activeWorkspaceId,
        activeView: state.activeView,
        selectedNoteId: state.selectedNoteId,
        selectedFolderId: state.selectedFolderId,
        selectedCollectionId: state.selectedCollectionId,
        selectedAttachmentId: state.selectedAttachmentId,
        serifMode: state.serifMode,
        dismissedReminderIds: state.dismissedReminderIds,
      }),
    },
  ),
);
