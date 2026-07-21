// In-memory only, on purpose: this holds parsed bank-statement transactions,
// and we'd rather that not linger indefinitely in localStorage. Switching
// between months within a session works without re-uploading; a refresh
// clears everything and starts from an empty state.
const runs = new Map();

/** @param {string} month @param {import('../categorize.js').Transaction[]} transactions */
export function saveRun(month, transactions) {
  runs.set(month, transactions);
}

/** @returns {string[]} months sorted ascending */
export function listMonths() {
  return [...runs.keys()].sort();
}

/** @param {string} month @returns {import('../categorize.js').Transaction[]|undefined} */
export function getRun(month) {
  return runs.get(month);
}

export function clearRuns() {
  runs.clear();
}
