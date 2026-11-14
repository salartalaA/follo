import { useLiveQuery } from 'dexie-react-hooks';
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  FilePlus2,
  Highlighter,
  ScanText,
  Trash2,
  Upload,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { addPdfAnnotation, createNote, storeAttachmentFile } from '../../db/actions';
import { db } from '../../db/database';
import { runLocalOcrOnImageSource } from '../../services/ocr';
import { useUIStore } from '../../store/useUIStore';
import type { PdfAnnotation } from '../../types/workspace';

export function PdfOcrView() {
  const {
    activeWorkspaceId,
    selectedAttachmentId,
    setSelectedAttachmentId,
    setSelectedNoteId,
    showToast,
  } = useUIStore();

  const attachments = useLiveQuery(
    () => db.attachments.orderBy('createdAt').reverse().toArray(),
    [],
    [],
  );

  const selected = attachments.find((a) => a.id === selectedAttachmentId) ?? attachments[0] ?? null;

  const annotations = useLiveQuery(
    () =>
      selected
        ? db.pdfAnnotations.where('attachmentId').equals(selected.id).sortBy('pageNumber')
        : Promise.resolve<PdfAnnotation[]>([]),
    [selected?.id],
    [] as PdfAnnotation[],
  );

  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [scale, setScale] = useState(1.1);
  const [pageText, setPageText] = useState('');
  const [pdfError, setPdfError] = useState('');

  const [annotationKind, setAnnotationKind] = useState<'highlight' | 'bookmark' | 'note'>(
    'highlight',
  );
  const [annotationExcerpt, setAnnotationExcerpt] = useState('');
  const [annotationComment, setAnnotationComment] = useState('');

  const [ocrStatus, setOcrStatus] = useState('');
  const [ocrText, setOcrText] = useState('');
  const [ocrBusy, setOcrBusy] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    setPageNumber(1);
    setPdfError('');
    setOcrText(selected?.extractedText ?? '');
    if (selected?.mimeType.startsWith('image/')) {
      const url = URL.createObjectURL(selected.blob);
      setImagePreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setImagePreviewUrl(null);
    return undefined;
  }, [selected?.id]);

  useEffect(() => {
    if (!selected?.mimeType.includes('pdf')) return;
    let cancelled = false;

    async function renderPdfPage() {
      if (!selected) return;
      try {
        setPdfError('');
        const pdfjsLib = await import('pdfjs-dist');
        pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
        const data = new Uint8Array(await selected.blob.arrayBuffer());
        const doc = await pdfjsLib.getDocument({ data }).promise;
        if (cancelled) return;
        setTotalPages(doc.numPages);
        const safePage = Math.min(Math.max(1, pageNumber), doc.numPages);
        const page = await doc.getPage(safePage);
        if (cancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext('2d');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          if (ctx) {
            await page.render({ canvasContext: ctx, viewport, canvas }).promise;
          }
        }

        const textContent = await page.getTextContent();
        const extracted = textContent.items
          .map((item) => ('str' in item && typeof item.str === 'string' ? item.str : ''))
          .filter(Boolean)
          .join(' ');
        if (!cancelled) {
          setPageText(extracted);
        }
      } catch (err) {
        if (!cancelled) {
          setPdfError(
            err instanceof Error
              ? `Could not open PDF (${err.message}). Password-protected or damaged PDFs cannot be opened.`
              : 'Failed to display PDF.',
          );
        }
      }
    }

    void renderPdfPage();
    return () => {
      cancelled = true;
    };
  }, [selected, pageNumber, scale]);

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const stored = await storeAttachmentFile(activeWorkspaceId, file);
    setSelectedAttachmentId(stored.id);
    showToast(`Saved "${file.name}"`);
  }

  async function handleAddAnnotation(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    if (!annotationExcerpt.trim() && !annotationComment.trim()) return;
    await addPdfAnnotation({
      attachmentId: selected.id,
      workspaceId: selected.workspaceId,
      pageNumber,
      kind: annotationKind,
      color: 'amber',
      excerpt: annotationExcerpt.trim() || `Page ${pageNumber}`,
      comment: annotationComment.trim(),
    });
    setAnnotationExcerpt('');
    setAnnotationComment('');
    showToast('Saved highlight');
  }

  async function handleRunLocalOcr() {
    if (!selected) return;
    setOcrBusy(true);
    setOcrStatus('Scanning text on your device...');
    try {
      const source = selected.mimeType.startsWith('image/') ? selected.blob : canvasRef.current;
      if (!source) {
        throw new Error('No image or PDF page ready to scan.');
      }
      const text = await runLocalOcrOnImageSource(source, (u) => {
        setOcrStatus(`${u.status} (${u.progress}%)`);
      });
      setOcrText(text || '(No readable text detected)');
      await db.attachments.update(selected.id, { extractedText: text });
      setOcrStatus('Scan complete');
      showToast('Text scanned locally');
    } catch (err) {
      setOcrStatus(err instanceof Error ? err.message : 'Scan failed');
    } finally {
      setOcrBusy(false);
    }
  }

  async function handleExtractToNote() {
    if (!selected) return;
    const bodyParts = [
      `<h1>Notes from ${selected.name}</h1>`,
      ocrText ? `<h2>Extracted Text</h2><p>${ocrText.replaceAll('\n', '</p><p>')}</p>` : '',
      annotations.length > 0
        ? `<h2>Highlights &amp; Bookmarks</h2><ul>${annotations
            .map(
              (a) =>
                `<li><p><strong>Page ${a.pageNumber} (${a.kind}):</strong> ${a.excerpt} ${a.comment ? `— ${a.comment}` : ''}</p></li>`,
            )
            .join('')}</ul>`
        : '',
    ]
      .filter(Boolean)
      .join('');

    const note = await createNote({
      workspaceId: activeWorkspaceId,
      title: `Notes — ${selected.name}`,
      contentHtml: bodyParts || '<p></p>',
      tags: ['pdf-notes'],
    });
    setSelectedNoteId(note.id);
    showToast('Created note from document');
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden lg:flex-row">
      {/* File Picker: Horizontal strip on mobile, left list on desktop */}
      <div className="shrink-0 border-b border-border/60 bg-card/45 p-4 backdrop-blur-xl lg:w-64 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-sm font-semibold text-foreground">
            Saved Files ({attachments.length})
          </h2>
          <Button
            type="button"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[38px] gap-1.5 rounded-xl px-3 text-xs font-semibold"
          >
            <Upload className="h-3.5 w-3.5" />
            Add File
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            aria-label="Upload PDF or image"
            accept=".pdf,image/*,.txt,.md"
            className="sr-only"
            onChange={(e) => void handleFileUpload(e)}
          />
        </div>

        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:space-y-1.5 lg:overflow-visible">
          {attachments.map((att) => (
            <div
              key={att.id}
              className={`group flex min-w-[180px] shrink-0 items-center justify-between gap-2 rounded-xl border px-3 py-2 text-xs backdrop-blur-md lg:min-w-0 ${
                selected?.id === att.id
                  ? 'border-primary bg-secondary/75 font-medium text-foreground'
                  : 'border-border/70 bg-card/65 text-muted-foreground hover:text-foreground'
              }`}
            >
              <button
                type="button"
                onClick={() => setSelectedAttachmentId(att.id)}
                className="min-w-0 flex-1 text-left"
              >
                <div className="truncate text-foreground">{att.name}</div>
                <div className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  {Math.max(1, Math.round(att.size / 1024))} KB
                </div>
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  void db.attachments.delete(att.id);
                  if (selectedAttachmentId === att.id) setSelectedAttachmentId(null);
                }}
                aria-label={`Delete file ${att.name}`}
                className="min-h-[32px] min-w-[32px] rounded-lg text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Viewer + Annotations */}
      <div className="flex flex-1 flex-col overflow-y-auto px-3.5 pt-4 content-pb-mobile sm:px-6 sm:pt-5 md:pb-10">
        {!selected ? (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Upload a PDF or image to read, highlight, and scan text on your device.
          </div>
        ) : (
          <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-5 xl:grid-cols-3">
            {/* Document Canvas */}
            <div className="space-y-3 xl:col-span-2">
              <Card className="flex flex-row flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="truncate font-display text-sm font-semibold text-foreground">
                    {selected.name}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {selected.mimeType}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {selected.mimeType.includes('pdf') && (
                    <div className="flex items-center gap-1 text-xs">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={pageNumber <= 1}
                        onClick={() => setPageNumber((p) => Math.max(1, p - 1))}
                        aria-label="Previous PDF page"
                        className="min-h-[38px] min-w-[38px] rounded-xl bg-background/50"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="px-2 font-mono tabular-nums text-foreground">
                        {pageNumber} / {totalPages}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={pageNumber >= totalPages}
                        onClick={() => setPageNumber((p) => Math.min(totalPages, p + 1))}
                        aria-label="Next PDF page"
                        className="min-h-[38px] min-w-[38px] rounded-xl bg-background/50"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setScale((s) => Number(Math.min(2, s + 0.15).toFixed(2)))}
                        aria-label="Zoom in PDF"
                        className="min-h-[38px] min-w-[38px] rounded-xl bg-background/50"
                      >
                        <ZoomIn className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => setScale((s) => Number(Math.max(0.7, s - 0.15).toFixed(2)))}
                        aria-label="Zoom out PDF"
                        className="min-h-[38px] min-w-[38px] rounded-xl bg-background/50"
                      >
                        <ZoomOut className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}

                  {(selected.mimeType.includes('pdf') ||
                    selected.mimeType.startsWith('image/')) && (
                    <Button
                      type="button"
                      disabled={ocrBusy}
                      onClick={() => void handleRunLocalOcr()}
                      className="min-h-[40px] gap-1.5 rounded-xl px-3.5 text-xs font-semibold"
                    >
                      <ScanText className="h-3.5 w-3.5" />
                      {ocrBusy ? 'Scanning...' : 'Scan Text'}
                    </Button>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void handleExtractToNote()}
                    className="min-h-[40px] gap-1.5 rounded-xl bg-background/50 px-3.5 text-xs font-medium"
                  >
                    <FilePlus2 className="h-3.5 w-3.5 text-primary" />
                    Save to Note
                  </Button>
                </div>
              </Card>

              {pdfError && (
                <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-xs text-destructive">
                  {pdfError}
                </div>
              )}

              <Card className="flex items-center justify-center overflow-auto bg-muted/35 p-3 sm:p-4">
                {selected.mimeType.includes('pdf') ? (
                  <canvas
                    ref={canvasRef}
                    className="max-w-full rounded-lg border border-border bg-white shadow-sm"
                  />
                ) : imagePreviewUrl ? (
                  <img
                    src={imagePreviewUrl}
                    alt={selected.name}
                    referrerPolicy="no-referrer"
                    className="max-h-[520px] rounded-xl object-contain"
                  />
                ) : (
                  <div className="p-8 text-xs text-muted-foreground">
                    Preview unavailable for {selected.mimeType}.
                  </div>
                )}
              </Card>

              {(pageText || ocrText || ocrStatus) && (
                <Card className="gap-0 p-4">
                  <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                    <span>Extracted Text</span>
                    {ocrStatus && <span className="font-mono text-[11px]">{ocrStatus}</span>}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-foreground">
                    {ocrText || pageText}
                  </p>
                </Card>
              )}
            </div>

            {/* Highlights & Notes */}
            <div className="space-y-4">
              <Card className="gap-0 p-4">
                <form onSubmit={(e) => void handleAddAnnotation(e)} className="space-y-3">
                  <h3 className="font-display text-sm font-semibold text-foreground">
                    Save Highlight (Page {pageNumber})
                  </h3>

                  <Tabs
                    value={annotationKind}
                    onValueChange={(value) => {
                      if (value === 'highlight' || value === 'bookmark' || value === 'note') {
                        setAnnotationKind(value);
                      }
                    }}
                  >
                    <TabsList className="grid h-10 w-full grid-cols-3 rounded-xl bg-muted/65 p-1">
                      <TabsTrigger value="highlight" className="rounded-lg text-xs capitalize">
                        Highlight
                      </TabsTrigger>
                      <TabsTrigger value="bookmark" className="rounded-lg text-xs capitalize">
                        Bookmark
                      </TabsTrigger>
                      <TabsTrigger value="note" className="rounded-lg text-xs capitalize">
                        Note
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <Textarea
                    rows={2}
                    value={annotationExcerpt}
                    onChange={(e) => setAnnotationExcerpt(e.target.value)}
                    placeholder="Quote or bookmark title..."
                    aria-label="Annotation excerpt"
                    className="rounded-xl bg-background/50 px-3 py-2 text-xs"
                  />
                  <Input
                    type="text"
                    value={annotationComment}
                    onChange={(e) => setAnnotationComment(e.target.value)}
                    placeholder="Personal note or takeaway..."
                    aria-label="Annotation note"
                    className="h-10 rounded-xl bg-background/50 px-3 text-xs"
                  />
                  <Button
                    type="submit"
                    className="min-h-[42px] w-full rounded-xl text-xs font-semibold"
                  >
                    Save Highlight
                  </Button>
                </form>
              </Card>

              <Card className="gap-0 p-4">
                <h3 className="font-display text-sm font-semibold text-foreground">
                  Saved Highlights ({annotations.length})
                </h3>
                <div className="mt-3 space-y-2.5">
                  {annotations.length === 0 ? (
                    <p className="text-xs text-muted-foreground">No highlights saved yet.</p>
                  ) : (
                    annotations.map((ann) => (
                      <div
                        key={ann.id}
                        className="rounded-xl border border-border/70 bg-background/45 p-3 text-xs"
                      >
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                          <Button
                            type="button"
                            variant="link"
                            size="xs"
                            onClick={() => setPageNumber(ann.pageNumber)}
                            className="h-auto gap-1 px-0 font-medium text-primary"
                          >
                            {ann.kind === 'bookmark' ? (
                              <Bookmark className="h-3 w-3" />
                            ) : (
                              <Highlighter className="h-3 w-3" />
                            )}
                            Page {ann.pageNumber} · {ann.kind}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => void db.pdfAnnotations.delete(ann.id)}
                            aria-label="Delete annotation"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <p className="mt-1 font-medium text-foreground">{ann.excerpt}</p>
                        {ann.comment && <p className="mt-1 text-muted-foreground">{ann.comment}</p>}
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
