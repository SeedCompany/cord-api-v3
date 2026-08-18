/**
 * True when this process was launched as the `pg refresh` console command.
 *
 * That command drops the Postgres schema, re-applies the migrations and reloads
 * the data itself, so anything that would write to Postgres during startup has
 * to stay out of its way — specifically the root-object setup in
 * AdminDrizzleService. A startup write that lands after the command has already
 * rebuilt the schema collides with the rows being loaded.
 *
 * The arguments are read from `process.argv` rather than from the parsed
 * command because Nest runs its startup hooks inside `app.init()`, which the
 * console entry point calls before it parses anything.
 *
 * `refresh` is looked for anywhere after `pg` rather than immediately after it,
 * because the option parser accepts a flag in between — `pg --fresh refresh`
 * is a valid way to invoke this and must not be missed.
 */
export const isPgRefreshInvocation = () => {
  const args = process.argv.slice(2);
  const pg = args.indexOf('pg');
  return pg !== -1 && args.includes('refresh', pg + 1);
};
