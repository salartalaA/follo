import { FileText } from 'lucide-react';
import { Card } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { createNote } from '../../db/actions';
import { NOTE_TEMPLATES } from '../../lib/templates';
import { useUIStore } from '../../store/useUIStore';

interface TemplatePickerModalProps {
  open: boolean;
  onClose: () => void;
}

export function TemplatePickerModal({ open, onClose }: TemplatePickerModalProps) {
  const { activeWorkspaceId, selectedFolderId, setSelectedNoteId, showToast } = useUIStore();

  async function handlePickTemplate(templateId: string) {
    const created = await createNote({
      workspaceId: activeWorkspaceId,
      folderId: selectedFolderId,
      templateId,
    });
    setSelectedNoteId(created.id);
    onClose();
    showToast('Created note from template');
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto p-5 sm:p-6">
        <DialogHeader className="border-b border-border/70 pb-3">
          <DialogTitle className="font-display text-base font-semibold">
            Start from a Template
          </DialogTitle>
          <DialogDescription className="text-xs">
            Begin with ready-made headings, checklists, or tables.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {NOTE_TEMPLATES.map((tpl) => (
            <Card key={tpl.id} className="gap-0 p-0 transition-colors hover:ring-primary/60">
              <button
                type="button"
                onClick={() => void handlePickTemplate(tpl.id)}
                className="flex min-h-[76px] w-full flex-col items-start gap-1.5 p-4 text-left"
              >
                <div className="flex w-full items-center justify-between gap-2">
                  <span className="flex items-center gap-2 font-display text-sm font-semibold text-foreground">
                    <FileText className="h-4 w-4 text-primary" />
                    {tpl.name}
                  </span>
                  <span className="text-xs text-muted-foreground">{tpl.category}</span>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">{tpl.description}</p>
              </button>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
