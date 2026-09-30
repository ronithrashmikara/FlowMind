'use client';

import type { Chunk, Source, SourceKind } from './types';

/** A page-like unit of a document: a PDF page, a slide, or a section of notes. */
export interface Segment {
  locator: string;
  text: string;
}

export const ACCEPTED = '.pdf,.pptx,.docx,.txt,.md,.markdown';
const MAX_BYTES = 60 * 1024 * 1024;

export function kindOf(filename: string): SourceKind | null {
  const ext = filename.toLowerCase().split('.').pop();
  if (ext === 'pdf' || ext === 'pptx' || ext === 'docx' || ext === 'txt' || ext === 'md') return ext;
  if (ext === 'markdown') return 'md';
  return null;
}

const decodeXml = (value: string) =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&');

/** Paragraph texts from OOXML, where runs are <a:t> (slides) or <w:t> (Word) inside <a:p>/<w:p>. */
function ooxmlParagraphs(xml: string, ns: 'a' | 'w'): string[] {
  const paragraphs = xml.split(new RegExp(`</${ns}:p>`));
  const run = new RegExp(`<${ns}:t(?:\\s[^>]*)?>([\\s\\S]*?)</${ns}:t>`, 'g');
  return paragraphs.map((p) => Array.from(p.matchAll(run), (m) => decodeXml(m[1])).join('').trim()).filter(Boolean);
}

async function parsePdf(data: ArrayBuffer): Promise<Segment[]> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
  const doc = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise;
  const segments: Segment[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let text = '';
    for (const item of content.items) {
      if (!('str' in item)) continue;
      text += item.str + (item.hasEOL ? '\n' : ' ');
    }
    segments.push({ locator: `p. ${i}`, text });
    page.cleanup();
  }
  await doc.destroy();
  return segments;
}

async function parsePptx(data: ArrayBuffer): Promise<Segment[]> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(data);
  const number = (name: string) => Number(name.match(/(\d+)\.xml$/)?.[1] ?? 0);
  const slides = Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n)).sort((a, b) => number(a) - number(b));
  const segments: Segment[] = [];
  for (const name of slides) {
    const n = number(name);
    const body = ooxmlParagraphs(await zip.file(name)!.async('string'), 'a');
    const notesFile = zip.file(`ppt/notesSlides/notesSlide${n}.xml`);
    const notes = notesFile ? ooxmlParagraphs(await notesFile.async('string'), 'a').filter((line) => !/^\d+$/.test(line)) : [];
    segments.push({ locator: `slide ${n}`, text: [...body, ...(notes.length ? ['Speaker notes: ' + notes.join(' ')] : [])].join('\n') });
  }
  return segments;
}

/** Groups paragraphs into sections, starting a new one at headings or when a section gets long. */
function sectionize(paragraphs: string[], isHeading: (p: string) => boolean): Segment[] {
  const segments: Segment[] = [];
  let current: string[] = [];
  let title = '';
  const flush = () => {
    if (current.join('').trim()) segments.push({ locator: title ? `§ ${title.slice(0, 32)}` : `part ${segments.length + 1}`, text: current.join('\n') });
    current = [];
  };
  for (const paragraph of paragraphs) {
    if (isHeading(paragraph) && current.join('\n').length > 300) {
      flush();
      title = paragraph.replace(/^#+\s*/, '');
    } else if (!title && isHeading(paragraph)) {
      title = paragraph.replace(/^#+\s*/, '');
    }
    current.push(paragraph);
    if (current.join('\n').length > 4000) flush();
  }
  flush();
  return segments;
}

async function parseDocx(data: ArrayBuffer): Promise<Segment[]> {
  const { default: JSZip } = await import('jszip');
  const zip = await JSZip.loadAsync(data);
  const xml = await zip.file('word/document.xml')?.async('string');
  if (!xml) throw new Error('This .docx has no document body.');
  const headings = new Set<string>();
  for (const p of xml.split('</w:p>')) {
    if (/<w:pStyle w:val="(Heading|Title)/i.test(p)) {
      const text = ooxmlParagraphs(p + '</w:p>', 'w')[0];
      if (text) headings.add(text);
    }
  }
  return sectionize(ooxmlParagraphs(xml, 'w'), (p) => headings.has(p));
}

function parseText(text: string): Segment[] {
  const lines = text.replace(/\r\n/g, '\n').split(/\n{2,}|\n(?=#)/).map((l) => l.trim()).filter(Boolean);
  return sectionize(lines, (p) => /^#{1,3}\s/.test(p));
}

const clean = (text: string) => text.replace(/[ \t ]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').replace(/(\w)-\n(\w)/g, '$1$2').trim();

/** Splits a segment into overlapping passages of ~1100 characters, breaking at sentence ends. */
export function chunkSegment(text: string, size = 1100, overlap = 160): string[] {
  const flat = text.replace(/\s+/g, ' ').trim();
  if (flat.length <= size * 1.25) return flat ? [flat] : [];
  const chunks: string[] = [];
  let start = 0;
  while (start < flat.length) {
    let end = Math.min(start + size, flat.length);
    if (end < flat.length) {
      const window = flat.slice(start + size * 0.6, end);
      const stop = Math.max(window.lastIndexOf('. '), window.lastIndexOf('? '), window.lastIndexOf('! '));
      end = stop > 0 ? start + size * 0.6 + stop + 1 : flat.lastIndexOf(' ', end) > start ? flat.lastIndexOf(' ', end) : end;
    }
    chunks.push(flat.slice(start, end).trim());
    if (end >= flat.length) break;
    start = Math.max(end - overlap, start + 1);
    const space = flat.indexOf(' ', start);
    if (space > 0 && space - start < 30) start = space + 1;
  }
  return chunks;
}

export const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;

/** Parsing Agent (runs in the browser): extracts clean text per page/slide/section and cuts it into cited passages. */
export async function parseFile(file: File): Promise<{ source: Source; chunks: Chunk[] }> {
  const kind = kindOf(file.name);
  if (!kind) throw new Error(`${file.name}: unsupported file type. Use PDF, PPTX, DOCX, TXT or Markdown.`);
  if (file.size > MAX_BYTES) throw new Error(`${file.name} is larger than 60 MB.`);
  const data = await file.arrayBuffer();
  const segments =
    kind === 'pdf' ? await parsePdf(data) : kind === 'pptx' ? await parsePptx(data) : kind === 'docx' ? await parseDocx(data) : parseText(new TextDecoder().decode(data));
  return segmentsToChunks(file.name, kind, segments);
}

/** Cleans page/slide segments and cuts them into passages that keep their locator for citations. */
export function segmentsToChunks(filename: string, kind: SourceKind, segments: Segment[]): { source: Source; chunks: Chunk[] } {
  const source: Source = { id: newId('src'), filename, kind, pages: segments.length, words: 0, addedAt: Date.now() };
  const chunks: Chunk[] = [];
  for (const segment of segments) {
    const text = clean(segment.text);
    source.words += text.split(/\s+/).filter(Boolean).length;
    for (const piece of chunkSegment(text)) {
      if (piece.length < 40) continue;
      chunks.push({ id: `${source.id}-${chunks.length}`, sourceId: source.id, filename, locator: segment.locator, text: piece });
    }
  }
  if (!chunks.length) throw new Error(kind === 'pdf' ? `${filename} has no extractable text (it may be a scanned image PDF).` : `${filename} has no readable text.`);
  return { source, chunks };
}
