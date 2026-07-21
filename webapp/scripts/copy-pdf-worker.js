// Copies pdfjs-dist's worker into public/ so it's served as a plain static
// asset — more robust across Vite versions than `?url`/`?worker` import
// suffixes, which have open bundling issues against pdfjs-dist v4/v5.
import { copyFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const src = join(root, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
const destDir = join(root, 'public');
const dest = join(destDir, 'pdf.worker.min.mjs');

if (!existsSync(src)) {
  console.warn(`[copy-pdf-worker] source not found: ${src} — skipping`);
  process.exit(0);
}

if (!existsSync(destDir)) mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`[copy-pdf-worker] copied to ${dest}`);
