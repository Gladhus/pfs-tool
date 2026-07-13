import type { ImportSource, PositionedLine, PositionedToken } from './types';

// pdfjs is heavy (~1MB + a worker), so it's dynamically imported here — the
// initial app bundle never pays for it; it loads only when a PDF is imported.
let workerReady = false;

async function loadPdfjs() {
  const pdfjs = await import('pdfjs-dist');
  if (!workerReady) {
    const workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
    workerReady = true;
  }
  return pdfjs;
}

const Y_TOLERANCE = 3; // items within this many units of y are the same physical line

/** Extract a PDF into full text (for format detection) + positioned lines (for table parsing). */
export async function extractPdf(file: File): Promise<ImportSource> {
  const pdfjs = await loadPdfjs();
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;

  const lines: PositionedLine[] = [];
  const textParts: string[] = [];

  try {
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p);
      const content = await page.getTextContent();

      const items = (content.items as Array<{ str?: string; width?: number; transform?: number[] }>)
        .filter(it => typeof it.str === 'string' && it.str.length > 0 && Array.isArray(it.transform))
        .map(it => ({ x: it.transform![4], y: it.transform![5], w: it.width ?? 0, str: it.str as string }))
        .sort((a, b) => b.y - a.y || a.x - b.x); // reading order: top-to-bottom, left-to-right

      let cur: { y: number; toks: PositionedToken[] } | null = null;
      const pageLines: PositionedLine[] = [];
      for (const it of items) {
        if (!cur || Math.abs(cur.y - it.y) > Y_TOLERANCE) {
          cur = { y: it.y, toks: [] };
          pageLines.push({ page: p, y: it.y, tokens: cur.toks, text: '' });
        }
        cur.toks.push({ x: it.x, w: it.w, str: it.str });
      }
      for (const ln of pageLines) {
        // Spaces are their own tokens, so join without adding any — then collapse.
        ln.text = ln.tokens.map(t => t.str).join('').replace(/\s+/g, ' ').trim();
        lines.push(ln);
        if (ln.text) textParts.push(ln.text);
      }
    }
  } finally {
    void doc.destroy();
  }

  return { filename: file.name, text: textParts.join('\n'), lines };
}
