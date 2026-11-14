export interface OcrProgress {
  status: string;
  progress: number;
}

export async function runLocalOcrOnImageSource(
  source: Blob | HTMLCanvasElement,
  onProgress?: (update: OcrProgress) => void,
): Promise<string> {
  const { createWorker } = await import('tesseract.js');
  const worker = await createWorker('eng', undefined, {
    logger: (msg) => {
      if (onProgress && typeof msg.status === 'string') {
        onProgress({
          status: msg.status,
          progress: typeof msg.progress === 'number' ? Math.round(msg.progress * 100) : 0,
        });
      }
    },
  });

  try {
    const result = await worker.recognize(source);
    return result.data.text.trim();
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      `Local OCR could not initialize (${detail}). If you are offline for the first time, Tesseract requires its English traineddata file to be cached once before offline OCR can run.`,
    );
  } finally {
    await worker.terminate();
  }
}
