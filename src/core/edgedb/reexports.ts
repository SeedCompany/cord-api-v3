// Only use this if you need the extra methods.
// Otherwise, for querying, use EdgeDb from below.
export { Client } from 'edgedb/dist/baseClient';
// Using this as it's a runtime symbol for the Executor TS shape
// which makes it perfect for injection.
export { Transaction as EdgeDb } from 'edgedb/dist/transaction';
