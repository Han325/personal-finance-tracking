function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

let txData = [];
let discarded = new Set();
let filterFrom = '';

function sourceBadge(sourceAccount) {
  const s = (sourceAccount || '').toUpperCase();
  if (s.startsWith('HLB')) return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">HLB</span>`;
  if (s.startsWith('OCBC')) return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300">OCBC</span>`;
  if (s.startsWith('RHB')) return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">RHB</span>`;
  return `<span class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">?</span>`;
}

window.__table = { toggleDiscard: (i) => { discarded.has(i) ? discarded.delete(i) : discarded.add(i); render(); } };

function render() {
  const tbody = document.getElementById('table-body');

  const visibleCount = txData.filter((row) => {
    const d = (row.date || '').substring(0, 10);
    return !filterFrom || d >= filterFrom;
  }).length;

  const discardedCount = discarded.size;
  const incomeCount = txData.filter((r) => r.type === 'income').length;
  const label = [
    discardedCount
      ? `${txData.length - discardedCount} of ${txData.length} · ${discardedCount} discarded`
      : `${txData.length} transactions`,
    incomeCount ? `${incomeCount} income` : null,
  ].filter(Boolean).join(' · ');
  document.getElementById('tx-count').textContent = label;

  if (!txData.length) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-12 text-center text-sm text-zinc-400 dark:text-zinc-500">No transactions loaded</td></tr>`;
    return;
  }
  if (!visibleCount) {
    tbody.innerHTML = `<tr><td colspan="5" class="px-4 py-12 text-center text-sm text-zinc-400 dark:text-zinc-500">No transactions match the date filter</td></tr>`;
    return;
  }

  tbody.innerHTML = txData.map((row, i) => {
    const date = (row.date || '').substring(0, 10);
    if (filterFrom && date < filterFrom) return '';

    const gone = discarded.has(i);
    const isIncome = row.type === 'income';
    const amt = row.amount != null ? `${isIncome ? '+' : '-'}${parseFloat(row.amount).toFixed(2)}` : '';
    const amtCls = isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-700 dark:text-zinc-300';
    const rowCls = gone
      ? 'opacity-35 line-through pointer-events-none select-none'
      : 'hover:bg-zinc-50/60 dark:hover:bg-zinc-800/30';
    const dCls = gone
      ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 pointer-events-auto'
      : 'text-zinc-300 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20';
    const dIcon = gone
      ? `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"/>`
      : `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>`;

    return `
    <tr class="border-b border-zinc-100 dark:border-zinc-800/80 transition-colors ${rowCls}">
      <td class="px-4 py-3">${sourceBadge(row.source_account)}</td>
      <td class="px-4 py-3 text-xs text-zinc-500 dark:text-zinc-400 whitespace-nowrap tabular-nums">${esc(date)}</td>
      <td class="px-4 py-3 text-xs text-zinc-700 dark:text-zinc-300 max-w-xs" style="word-break:break-word">${esc(row.description || '')}</td>
      <td class="px-4 py-3 text-xs text-right font-mono tabular-nums ${amtCls} whitespace-nowrap">${esc(amt)}</td>
      <td class="px-3 py-3 text-right">
        <button onclick="window.__table.toggleDiscard(${i})" title="${gone ? 'Restore' : 'Discard'}"
                class="p-1.5 rounded-lg transition-colors ${dCls}">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">${dIcon}</svg>
        </button>
      </td>
    </tr>`;
  }).join('');
}

export function initTableControls() {
  document.getElementById('table-filter-from').addEventListener('change', (e) => {
    filterFrom = e.target.value;
    render();
  });
  document.getElementById('table-filter-clear').addEventListener('click', () => {
    filterFrom = '';
    document.getElementById('table-filter-from').value = '';
    render();
  });
}

/** @param {import('../categorize.js').Transaction[]} transactions */
export function setTransactions(transactions) {
  txData = transactions;
  discarded = new Set();
  document.getElementById('results-card').classList.remove('hidden');
  render();
}

/** @returns {import('../categorize.js').Transaction[]} non-discarded rows, ignoring the date filter (matches the CSV export scope) */
export function getKeptTransactions() {
  return txData.filter((_, i) => !discarded.has(i));
}
