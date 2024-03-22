// Only use this if you need the extra methods.
// Otherwise, for querying, use EdgeDb from below.
export { Client } from 'edgedb/dist/baseClient.js';

export { default as e, type $infer } from './generated-client';
export * as $ from './generated-client/reflection';
