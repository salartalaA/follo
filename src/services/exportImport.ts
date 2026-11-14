import { Document, HeadingLevel, Packer, Paragraph, TextRun } from 'docx';
import { jsPDF } from 'jspdf';
import JSZip from 'jszip';
import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { createNote, createStructuredCollection, logActivity, uid } from '../db/actions';
import { db } from '../db/database';
import {
  generateRtfFromText,
  htmlToMarkdown,
  htmlToPlainText,
  markdownToHtml,
  parseRtfToPlainText,
} from '../lib/markdown';
import { validateBackupPayload, type WorkspaceBackupPayload } from '../lib/validators';
import type {
  CollectionField,
  CollectionRow,
  Note,
  StructuredCollection,
} from '../types/workspace';

export type ExportFormat = 'txt' | 'md' | 'html' | 'pdf' | 'docx' | 'rtf';

export function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function sanitizeFileName(name: string): string {
  return (name.trim() || 'folio-document')
    .replace(/[^a-zA-Z0-9-_ ]+/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase();
}

export async function exportNoteAsFormat(note: Note, format: ExportFormat): Promise<void> {
  const baseName = sanitizeFileName(note.title);

  if (format === 'txt') {
    const blob = new Blob(
      [`${note.title}\n${'='.repeat(note.title.length)}\n\n${note.contentText}`],
      {
        type: 'text/plain;charset=utf-8',
      },
    );
    triggerBlobDownload(blob, `${baseName}.txt`);
    return;
  }

  if (format === 'md') {
    const md = `# ${note.title}\n\n${htmlToMarkdown(note.contentHtml)}`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    triggerBlobDownload(blob, `${baseName}.md`);
    return;
  }

  if (format === 'html') {
    const htmlDoc = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${escapeHtml(note.title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:720px;margin:48px auto;padding:0 24px;line-height:1.65;color:#18181b}pre{background:#18181b;color:#f4f4f5;padding:16px;border-radius:8px;overflow:auto}table{border-collapse:collapse;width:100%}th,td{border:1px solid #d4d4d8;padding:8px;text-align:left}</style>
</head>
<body><h1>${escapeHtml(note.title)}</h1>${note.contentHtml}</body>
</html>`;
    const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
    triggerBlobDownload(blob, `${baseName}.html`);
    return;
  }

  if (format === 'rtf') {
    const rtf = generateRtfFromText(note.title, note.contentText);
    const blob = new Blob([rtf], { type: 'application/rtf;charset=utf-8' });
    triggerBlobDownload(blob, `${baseName}.rtf`);
    return;
  }

  if (format === 'docx') {
    const paragraphs = note.contentText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 0);
    const doc = new Document({
      sections: [
        {
          children: [
            new Paragraph({ text: note.title, heading: HeadingLevel.HEADING_1 }),
            ...paragraphs.map(
              (line) =>
                new Paragraph({
                  children: [new TextRun(line)],
                  spacing: { after: 120 },
                }),
            ),
          ],
        },
      ],
    });
    const blob = await Packer.toBlob(doc);
    triggerBlobDownload(blob, `${baseName}.docx`);
    return;
  }

  // PDF export via jsPDF
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(18);
  pdf.text(note.title || 'Untitled Note', 48, 56);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(11);
  const lines = pdf.splitTextToSize(note.contentText || '(Empty document)', 500) as string[];
  let cursorY = 88;
  for (const line of lines) {
    if (cursorY > 780) {
      pdf.addPage();
      cursorY = 56;
    }
    pdf.text(line, 48, cursorY);
    cursorY += 16;
  }
  const pdfBlob = pdf.output('blob');
  triggerBlobDownload(pdfBlob, `${baseName}.pdf`);
}

export function exportCollectionAsSpreadsheet(
  collection: StructuredCollection,
  rows: CollectionRow[],
  format: 'csv' | 'xlsx',
): void {
  const headers = collection.fields.map((f) => f.name);
  const matrix: Array<Array<string | number | boolean>> = [
    headers,
    ...rows.map((row) =>
      collection.fields.map((field) => {
        const val = row.values[field.id];
        return val === null || val === undefined ? '' : val;
      }),
    ),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(matrix);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, collection.name.slice(0, 31) || 'Sheet1');

  const baseName = sanitizeFileName(collection.name);
  if (format === 'csv') {
    const csv = XLSX.utils.sheet_to_csv(worksheet);
    triggerBlobDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${baseName}.csv`);
  } else {
    const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    triggerBlobDownload(
      new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      }),
      `${baseName}.xlsx`,
    );
  }
}

export async function buildFullBackupPayload(): Promise<WorkspaceBackupPayload> {
  const [
    workspaces,
    folders,
    notes,
    noteVersions,
    inboxItems,
    tasks,
    collections,
    collectionRows,
    snippets,
    bookmarks,
    smartCollections,
  ] = await Promise.all([
    db.workspaces.toArray(),
    db.folders.toArray(),
    db.notes.toArray(),
    db.noteVersions.toArray(),
    db.inboxItems.toArray(),
    db.tasks.toArray(),
    db.collections.toArray(),
    db.collectionRows.toArray(),
    db.snippets.toArray(),
    db.bookmarks.toArray(),
    db.smartCollections.toArray(),
  ]);

  return {
    schemaVersion: 1,
    exportedAt: Date.now(),
    app: 'folio',
    workspaces,
    folders,
    notes,
    noteVersions,
    inboxItems,
    tasks,
    collections,
    collectionRows,
    snippets,
    bookmarks,
    smartCollections,
  };
}

export async function exportFullWorkspaceJson(): Promise<void> {
  const payload = await buildFullBackupPayload();
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json;charset=utf-8',
  });
  const stamp = new Date().toISOString().slice(0, 10);
  triggerBlobDownload(blob, `folio-backup-${stamp}.json`);
}

export async function exportFullWorkspaceZip(): Promise<void> {
  const payload = await buildFullBackupPayload();
  const attachments = await db.attachments.toArray();
  const zip = new JSZip();

  zip.file('folio-backup.json', JSON.stringify(payload, null, 2));

  const notesDir = zip.folder('notes');
  if (notesDir) {
    for (const note of payload.notes) {
      const ws = payload.workspaces.find((w) => w.id === note.workspaceId)?.name ?? 'workspace';
      const fileName = `${sanitizeFileName(ws)}/${sanitizeFileName(note.title)}-${note.id.slice(-6)}.md`;
      notesDir.file(fileName, `# ${note.title}\n\n${htmlToMarkdown(note.contentHtml)}`);
    }
  }

  const filesDir = zip.folder('attachments');
  if (filesDir) {
    for (const att of attachments) {
      filesDir.file(att.name, att.blob);
    }
  }

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const stamp = new Date().toISOString().slice(0, 10);
  triggerBlobDownload(zipBlob, `folio-vault-${stamp}.zip`);
}

export interface ImportResult {
  summary: string;
  createdNotes: number;
  createdCollections: number;
}

export async function importDocumentFile(file: File, workspaceId: string): Promise<ImportResult> {
  const lower = file.name.toLowerCase();

  if (lower.endsWith('.doc') || lower.endsWith('.pages') || lower.endsWith('.key')) {
    throw new Error(
      `Unsupported legacy binary format (${file.name}). Please convert .doc or .pages files to .docx, .md, .txt, or .rtf before importing.`,
    );
  }

  if (lower.endsWith('.txt') || lower.endsWith('.md') || lower.endsWith('.markdown')) {
    const text = await file.text();
    const title = file.name.replace(/\.(txt|md|markdown)$/i, '');
    const html = lower.endsWith('.txt')
      ? `<p>${escapeHtml(text).replaceAll('\n\n', '</p><p>').replaceAll('\n', '<br>')}</p>`
      : markdownToHtml(text);
    await createNote({ workspaceId, title, contentHtml: html, tags: ['imported'] });
    return {
      summary: `Imported "${file.name}" as a note.`,
      createdNotes: 1,
      createdCollections: 0,
    };
  }

  if (lower.endsWith('.html') || lower.endsWith('.htm')) {
    const raw = await file.text();
    const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const titleMatch = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = titleMatch?.[1]?.trim() || file.name.replace(/\.(html|htm)$/i, '');
    const html = bodyMatch?.[1]?.trim() || raw;
    await createNote({ workspaceId, title, contentHtml: html, tags: ['imported'] });
    return {
      summary: `Imported HTML document "${file.name}".`,
      createdNotes: 1,
      createdCollections: 0,
    };
  }

  if (lower.endsWith('.rtf')) {
    const raw = await file.text();
    const plain = parseRtfToPlainText(raw);
    const title = file.name.replace(/\.rtf$/i, '');
    const html = `<p>${escapeHtml(plain).replaceAll('\n\n', '</p><p>').replaceAll('\n', '<br>')}</p>`;
    await createNote({ workspaceId, title, contentHtml: html, tags: ['imported'] });
    return {
      summary: `Imported RTF document "${file.name}".`,
      createdNotes: 1,
      createdCollections: 0,
    };
  }

  if (lower.endsWith('.docx')) {
    const arrayBuffer = await file.arrayBuffer();
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const title = file.name.replace(/\.docx$/i, '');
    await createNote({
      workspaceId,
      title,
      contentHtml: result.value || `<p>${escapeHtml(htmlToPlainText(result.value))}</p>`,
      tags: ['imported', 'docx'],
    });
    return {
      summary: `Imported DOCX document "${file.name}".`,
      createdNotes: 1,
      createdCollections: 0,
    };
  }

  if (lower.endsWith('.pdf')) {
    const pdfjsLib = await import('pdfjs-dist');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
    const data = new Uint8Array(await file.arrayBuffer());
    const pdfDoc = await pdfjsLib.getDocument({ data }).promise;
    const pagesText: string[] = [];
    for (let i = 1; i <= pdfDoc.numPages; i += 1) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      const strings = textContent.items
        .map((item) => ('str' in item && typeof item.str === 'string' ? item.str : ''))
        .filter(Boolean);
      pagesText.push(strings.join(' '));
    }
    const combined = pagesText.join('\n\n').trim();
    const title = file.name.replace(/\.pdf$/i, '');
    await createNote({
      workspaceId,
      title,
      contentHtml: combined
        ? `<p>${escapeHtml(combined).replaceAll('\n\n', '</p><p>')}</p>`
        : '<p>Scanned PDF imported with no embedded text layer. Open it in PDF &amp; OCR Reader to run local OCR.</p>',
      tags: ['imported', 'pdf'],
    });
    await db.attachments.put({
      id: uid('att'),
      workspaceId,
      name: file.name,
      mimeType: 'application/pdf',
      size: file.size,
      blob: file,
      extractedText: combined,
      linkedNoteId: null,
      createdAt: Date.now(),
    });
    return {
      summary: `Imported PDF "${file.name}" (${pdfDoc.numPages} pages).`,
      createdNotes: 1,
      createdCollections: 0,
    };
  }

  if (lower.endsWith('.csv') || lower.endsWith('.xlsx')) {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });
    const firstSheetName = wb.SheetNames[0];
    if (!firstSheetName) {
      throw new Error('Spreadsheet contains no worksheets.');
    }
    const sheet = wb.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json<Array<string | number | boolean>>(sheet, { header: 1 });
    if (rows.length === 0) {
      throw new Error('Spreadsheet is empty.');
    }
    const headerRow = rows[0] ?? [];
    const fields: CollectionField[] = headerRow.map((cell, idx) => ({
      id: `col-${idx}`,
      name: String(cell || `Column ${idx + 1}`),
      type: 'text',
    }));
    const collectionName = file.name.replace(/\.(csv|xlsx)$/i, '');
    const collection = await createStructuredCollection(
      workspaceId,
      collectionName,
      `Imported from ${file.name}`,
      fields,
    );
    const now = Date.now();
    const rowRecords: CollectionRow[] = rows.slice(1).map((r, rowIdx) => {
      const values: Record<string, string | number | boolean | null> = {};
      fields.forEach((f, colIdx) => {
        const rawVal = r[colIdx];
        values[f.id] = rawVal === undefined ? '' : rawVal;
      });
      return {
        id: uid(`imp-${rowIdx}`),
        collectionId: collection.id,
        workspaceId,
        values,
        createdAt: now,
        updatedAt: now,
      };
    });
    if (rowRecords.length > 0) {
      await db.collectionRows.bulkPut(rowRecords);
    }
    return {
      summary: `Imported "${file.name}" as structured collection (${rowRecords.length} rows).`,
      createdNotes: 0,
      createdCollections: 1,
    };
  }

  if (lower.endsWith('.zip')) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const backupEntry = zip.file('folio-backup.json');
    if (backupEntry) {
      const jsonText = await backupEntry.async('text');
      const parsed: unknown = JSON.parse(jsonText);
      const validation = validateBackupPayload(parsed);
      if (!validation.valid || !validation.payload) {
        throw new Error(`Invalid ZIP backup manifest: ${validation.errors.join(' ')}`);
      }
      await restoreFromBackupPayload(validation.payload, {
        workspaces: true,
        notes: true,
        tasks: true,
        collections: true,
        snippetsAndBookmarks: true,
        mode: 'merge',
      });
      return {
        summary: `Restored Folio ZIP archive (${validation.payload.notes.length} notes).`,
        createdNotes: validation.payload.notes.length,
        createdCollections: validation.payload.collections.length,
      };
    }

    let importedCount = 0;
    const entries = Object.values(zip.files).filter(
      (f) => !f.dir && /\.(md|txt|markdown)$/i.test(f.name),
    );
    for (const entry of entries) {
      const text = await entry.async('text');
      const cleanName =
        entry.name
          .split('/')
          .pop()
          ?.replace(/\.(md|txt|markdown)$/i, '') || 'Imported Note';
      await createNote({
        workspaceId,
        title: cleanName,
        contentHtml: markdownToHtml(text),
        tags: ['zip-import'],
      });
      importedCount += 1;
    }
    if (importedCount === 0) {
      throw new Error('ZIP archive contained no folio-backup.json or .md/.txt notes.');
    }
    return {
      summary: `Imported ${importedCount} Markdown/text notes from ZIP.`,
      createdNotes: importedCount,
      createdCollections: 0,
    };
  }

  throw new Error(
    `Unsupported file extension for "${file.name}". Supported: TXT, MD, HTML, PDF, DOCX, RTF, CSV, XLSX, JSON, ZIP.`,
  );
}

export interface SelectiveRestoreOptions {
  workspaces: boolean;
  notes: boolean;
  tasks: boolean;
  collections: boolean;
  snippetsAndBookmarks: boolean;
  mode: 'merge' | 'replace';
}

export async function restoreFromBackupPayload(
  payload: WorkspaceBackupPayload,
  options: SelectiveRestoreOptions,
): Promise<void> {
  await db.transaction(
    'rw',
    [
      db.workspaces,
      db.folders,
      db.notes,
      db.noteVersions,
      db.inboxItems,
      db.tasks,
      db.collections,
      db.collectionRows,
      db.snippets,
      db.bookmarks,
      db.smartCollections,
    ],
    async () => {
      if (options.mode === 'replace') {
        if (options.workspaces) {
          await db.workspaces.clear();
          await db.folders.clear();
        }
        if (options.notes) {
          await db.notes.clear();
          await db.noteVersions.clear();
        }
        if (options.tasks) {
          await db.tasks.clear();
        }
        if (options.collections) {
          await db.collections.clear();
          await db.collectionRows.clear();
        }
        if (options.snippetsAndBookmarks) {
          await db.snippets.clear();
          await db.bookmarks.clear();
        }
      }

      if (options.workspaces) {
        await db.workspaces.bulkPut(payload.workspaces);
        await db.folders.bulkPut(payload.folders);
      }
      if (options.notes) {
        await db.notes.bulkPut(payload.notes);
        await db.noteVersions.bulkPut(payload.noteVersions);
        await db.smartCollections.bulkPut(payload.smartCollections);
      }
      if (options.tasks) {
        await db.tasks.bulkPut(payload.tasks);
        await db.inboxItems.bulkPut(payload.inboxItems);
      }
      if (options.collections) {
        await db.collections.bulkPut(payload.collections);
        await db.collectionRows.bulkPut(payload.collectionRows);
      }
      if (options.snippetsAndBookmarks) {
        await db.snippets.bulkPut(payload.snippets);
        await db.bookmarks.bulkPut(payload.bookmarks);
      }
    },
  );
  await logActivity(
    'ws-personal',
    'vault',
    'backup',
    'Restored',
    `Restored backup (${options.mode} mode)`,
  );
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
