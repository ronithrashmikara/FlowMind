// Serve the pdf.js worker as a static file so PDFs are parsed in the browser (no upload size limits, no server parsing).
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const source = join(dirname(require.resolve('pdfjs-dist/package.json')), 'legacy', 'build', 'pdf.worker.min.mjs');
mkdirSync('public', { recursive: true });
copyFileSync(source, join('public', 'pdf.worker.min.mjs'));
