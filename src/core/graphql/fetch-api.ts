import { webcrypto as crypto } from 'node:crypto';
import { URLPattern } from 'urlpattern-polyfill';

/**
 * Yoga uses `@whatwg-node/fetch` by default for its fetch API.
 * This is just a ponyfill for the web fetch, and its types reference
 * the TS DOM library to provide these.
 * https://github.com/ardatan/whatwg-node/blob/master/packages/fetch/dist/index.d.ts#L1
 * That sucks because it implicitly adds the TS DOM library for us even though we
 * don't want it.
 * It adds types like global `window` which is never useful for us.
 *
 * Because our runtime is always Node.js, that library just points to the
 * `@whatwg-node/node-fetch` ponyfill library.
 * This library doesn't use the TS DOM library types, I'm guessing because
 * it has to actually do the work to make the compatible shapes instead of
 * just forwarding to the builtin globals (in browser, Deno, Bun, etc. envs.)
 * I swapped out (via yarn resolutions) this "routing" library
 * `@whatwg-node/fetch` for `@whatwg-node/node-fetch` since we're always using Node.js.
 * This avoids the TS DOM library being implicitly included.
 *
 * Below are overrides for these types.
 */
export const fetchApiForYoga = {
  /**
   * `@whatwg-node/node-fetch` doesn't include URLPattern.
   * `@whatwg-node/fetch` pulls it in separately.
   * Possibly for its conditional logic for Bun.
   * https://github.com/ardatan/whatwg-node/blob/bebc159/packages/fetch/dist/create-node-ponyfill.js#L8-L12
   */
  URLPattern,
  /**
   * `@whatwg-node/fetch` also adds this separate from `@whatwg-node/node-fetch`.
   * https://github.com/ardatan/whatwg-node/blob/bebc159/packages/fetch/dist/create-node-ponyfill.js#L89-L92
   */
  crypto,
};
