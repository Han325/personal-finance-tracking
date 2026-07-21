/**
 * @typedef {Object} Transaction
 * @property {string} date            YYYY-MM-DD
 * @property {string} description
 * @property {number} amount          positive
 * @property {string} currency
 * @property {string} payment_type
 * @property {string} source_account
 */

/** @returns {Transaction} */
export function makeTransaction({ date, description, amount, currency, payment_type, source_account }) {
  return { date, description, amount, currency, payment_type, source_account };
}
