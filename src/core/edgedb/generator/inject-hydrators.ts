import { HydratorMap } from './find-hydration-shapes';
import { toFqn } from './util';

export const injectHydrators = (query: string, map: HydratorMap) => {
  return query
    .replaceAll(RE_SELECT, (_, type: string) => {
      const hydration = map.get(toFqn(type));
      if (!hydration) {
        return _;
      }
      return `select ${type} {${hydration.fields}}`;
    })
    .replaceAll(RE_HYDRATE_CALL, (fakeFn) => {
      const matches = fakeFn.match(RE_HYDRATE_EXTRACT);
      if (!matches) {
        return fakeFn;
      }
      const [, key, variable] = matches;
      const hydration = map.get(toFqn(key));
      if (!hydration) {
        return fakeFn;
      }
      const injected = `(select ${variable} {${hydration.fields.replaceAll(
        RegExp('(?<!\\sDETACHED\\s)' + hydration.type, 'gi'),
        variable,
      )}})`;
      return injected;
    });
};

export const hydratorsNeeded = (query: string) => {
  const needed = new Set<string>();
  query
    .replaceAll(RE_SELECT, (_, type: string) => {
      needed.add(toFqn(type));
      return _;
    })
    .replaceAll(RE_HYDRATE_CALL, (fakeFn) => {
      const matches = fakeFn.match(RE_HYDRATE_EXTRACT);
      if (!matches) {
        return fakeFn;
      }
      needed.add(toFqn(matches[1]));
      return fakeFn;
    });
  return needed;
};

const RE_SELECT = /select\s+([\w:]+)\s*\{}/gi;
const RE_HYDRATE_CALL = /hydrate\(.+\)/g;
const RE_HYDRATE_EXTRACT = /hydrate\(['"]([\w:]+)['"],\s*<json>(.+)\)/;
