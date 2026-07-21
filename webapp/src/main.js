import { runPipeline, transactionsToCsv } from './pipeline.js';
import { initTheme } from './ui/theme.js';
import { showToast } from './ui/toast.js';
import { initFileUpload, getTaggedFiles } from './ui/fileUpload.js';
import { initTableControls, setTransactions, getKeptTransactions } from './ui/table.js';
import { saveRun, listMonths, getRun } from './ui/runsStore.js';

let currentMonth = '';

function refreshMonthSelect(selectMonth) {
  const sel = document.getElementById('month-select');
  const months = listMonths();
  sel.innerHTML = months.map((m) =>
    `<option value="${m}"${m === selectMonth ? ' selected' : ''}>${m}</option>`
  ).join('');
}

function loadMonth(month) {
  if (!month) return;
  currentMonth = month;
  setTransactions(getRun(month) || []);
}

async function handleRunPipeline() {
  const month = document.getElementById('month-input').value.trim();
  if (!month) { showToast('Select a month first', 'error'); return; }

  const { hlbFile, ocbcFile, rhbFile, untaggedCount } = getTaggedFiles();
  if (!hlbFile && !ocbcFile && !rhbFile) { showToast('Tag at least one file before running', 'error'); return; }
  if (untaggedCount) showToast(`${untaggedCount} untagged file(s) will be skipped`, 'warn');

  const btn = document.getElementById('run-btn');
  btn.disabled = true;
  document.getElementById('run-status').classList.remove('hidden');

  let result;
  let error = null;
  try {
    result = await runPipeline({ hlbFile, ocbcFile, rhbFile });
  } catch (e) {
    error = e;
  }

  btn.disabled = false;
  document.getElementById('run-status').classList.add('hidden');

  const logLines = error ? [...(result?.log || []), '', `Error: ${error.message}`] : result.log;
  document.getElementById('log-content').textContent = logLines.join('\n').trim();
  document.getElementById('run-log').classList.remove('hidden');

  if (error) {
    showToast('Pipeline failed — check log', 'error');
    return;
  }

  saveRun(month, result.transactions);
  showToast('Pipeline complete', 'ok');
  refreshMonthSelect(month);
  loadMonth(month);
}

function downloadCsv() {
  if (!currentMonth) { showToast('No month loaded', 'error'); return; }

  const rows = getKeptTransactions();
  if (!rows.length) { showToast('Nothing to download — all rows discarded', 'warn'); return; }

  const csv = transactionsToCsv(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${currentMonth}_wallet_import.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function init() {
  initTheme();
  initFileUpload();
  initTableControls();

  document.getElementById('month-input').value = new Date().toISOString().slice(0, 7);
  document.getElementById('run-btn').addEventListener('click', handleRunPipeline);
  document.getElementById('download-btn').addEventListener('click', downloadCsv);
  document.getElementById('month-select').addEventListener('change', (e) => loadMonth(e.target.value));

  const months = listMonths();
  if (months.length) {
    refreshMonthSelect(months[months.length - 1]);
    loadMonth(months[months.length - 1]);
  }
}

init();
