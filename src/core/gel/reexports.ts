// Only use this if you need the extra methods.
// Otherwise, for querying, use our Gel service.
export { Client } from 'gel/dist/baseClient.js';

export { default as e, type $infer } from './generated-client';
export * as $ from './generated-client/reflection';
