import { Transaction } from 'edgedb/dist/transaction.js';

// Only use this if you need the extra methods.
// Otherwise, for querying, use EdgeDb from below.
export { Client } from 'edgedb/dist/baseClient.js';

// Using this as it's a runtime symbol for the Executor TS shape
// which makes it perfect for injection.
// @ts-expect-error private constructor; doesn't matter that's not how we are using it.
// We could just export the Transaction as an aliased named, but this also
// allows REPL to reference it with the correct name.
export abstract class EdgeDB extends Transaction {}
