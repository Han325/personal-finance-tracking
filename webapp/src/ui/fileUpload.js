const PDF_ICON = `<svg class="w-4 h-4 shrink-0 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>`;
const CSV_ICON = `<svg class="w-4 h-4 shrink-0 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`;

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

let uploadedFiles = [];

function autoTag(filename) {
  const name = filename.toLowerCase();
  if (name.includes('rhb') || name.includes('vlm')) return 'rhb';
  if (name.includes('ocbc') || name.includes('transactionhistory')) return 'ocbc';
  if (name.includes('paysave') || name.includes('hlb') || name.includes('casatran') || name.endsWith('.pdf')) return 'hlb';
  return '';
}

export function initFileUpload() {
  const dropZone = document.getElementById('drop-zone');
  const fileInput = document.getElementById('file-input');

  dropZone.addEventListener('click', () => fileInput.click());

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('border-zinc-400', 'bg-zinc-50');
  });
  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-zinc-400', 'bg-zinc-50');
  });
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('border-zinc-400', 'bg-zinc-50');
    addFiles(Array.from(e.dataTransfer.files));
  });

  fileInput.addEventListener('change', (e) => {
    addFiles(Array.from(e.target.files));
    e.target.value = '';
  });
}

function addFiles(newFiles) {
  for (const f of newFiles) {
    if (uploadedFiles.find((u) => u.file.name === f.name)) continue;
    uploadedFiles.push({ file: f, tag: autoTag(f.name) });
  }
  renderFileList();
}

function removeFile(idx) {
  uploadedFiles.splice(idx, 1);
  renderFileList();
}

function setTag(idx, tag) {
  uploadedFiles[idx].tag = tag;
  renderFileList();
}

// exposed for the inline onclick handlers rendered into innerHTML below
window.__fileUpload = { removeFile, setTag };

function renderFileList() {
  const el = document.getElementById('file-list');
  if (!uploadedFiles.length) { el.innerHTML = ''; return; }
  const tagOn = 'px-2.5 py-1 rounded-md border text-xs font-semibold transition-colors bg-zinc-900 dark:bg-zinc-50 text-white dark:text-zinc-900 border-zinc-900 dark:border-zinc-50';
  const tagOff = 'px-2.5 py-1 rounded-md border text-xs font-medium transition-colors bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border-zinc-200 dark:border-zinc-600 hover:border-zinc-400';
  el.innerHTML = uploadedFiles.map((u, i) => {
    const icon = u.file.name.toLowerCase().endsWith('.pdf') ? PDF_ICON : CSV_ICON;
    return `
    <div class="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700">
      ${icon}
      <span class="flex-1 text-sm text-zinc-700 dark:text-zinc-300 truncate min-w-0" title="${esc(u.file.name)}">${esc(u.file.name)}</span>
      <div class="flex items-center gap-1.5 shrink-0">
        <button onclick="window.__fileUpload.setTag(${i},'hlb')"  title="HLB Pay &amp; Save — CSV export or PDF" class="${u.tag === 'hlb' ? tagOn : tagOff}">HLB <span class="opacity-60 font-normal">csv/pdf</span></button>
        <button onclick="window.__fileUpload.setTag(${i},'ocbc')" title="OCBC 360 — CSV export"                 class="${u.tag === 'ocbc' ? tagOn : tagOff}">OCBC <span class="opacity-60 font-normal">csv</span></button>
        <button onclick="window.__fileUpload.setTag(${i},'rhb')"  title="RHB — credit card PDF statement or VLM CSV output" class="${u.tag === 'rhb' ? tagOn : tagOff}">RHB <span class="opacity-60 font-normal">csv/pdf</span></button>
      </div>
      <button onclick="window.__fileUpload.removeFile(${i})"
              class="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>`;
  }).join('');
}

export function clearFiles() {
  uploadedFiles = [];
  renderFileList();
}

/** @returns {{hlbFile?: File, ocbcFile?: File, rhbFile?: File, untaggedCount: number}} */
export function getTaggedFiles() {
  const tagged = uploadedFiles.filter((u) => u.tag);
  const untaggedCount = uploadedFiles.length - tagged.length;
  const result = { untaggedCount };
  for (const u of tagged) {
    if (u.tag === 'hlb') result.hlbFile = u.file;
    if (u.tag === 'ocbc') result.ocbcFile = u.file;
    if (u.tag === 'rhb') result.rhbFile = u.file;
  }
  return result;
}
