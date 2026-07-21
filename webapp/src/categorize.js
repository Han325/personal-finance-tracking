/**
 * @typedef {Object} Transaction
 * @property {string} date            YYYY-MM-DD
 * @property {string} description
 * @property {number} amount          positive magnitude — sign is decided at export time by `type`
 * @property {'expense'|'income'} type
 * @property {string} currency
 * @property {string} payment_type
 * @property {string} source_account
 */

/** @returns {Transaction} */
export function makeTransaction({ date, description, amount, type = 'expense', currency, payment_type, source_account }) {
  return { date, description, amount, type, currency, payment_type, source_account };
}
