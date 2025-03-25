export function eqlDoesIntersect(
  actual: string,
  expected: Iterable<string>,
  castName?: string,
) {
  const list = [...expected];
  if (list.length === 1) {
    const expectedStr = castName ? `${castName}.${list[0]}` : `'${list[0]}'`;
    return `${expectedStr} in ${actual}`;
  }
  return `exists (${eqlLiteralSet(list, castName)} intersect ${actual})`;
}

export const eqlInLiteralSet = (
  actual: string,
  items: Iterable<string>,
  castName?: string,
) => {
  const list = [...items];
  if (list.length === 1) {
    const isEnum = castName && castName !== castName.toLowerCase();
    const expectedStr = isEnum
      ? `${castName}.${list[0]}`
      : castName
      ? `<${castName}>'${list[0]}'`
      : `'${list[0]}'`;
    return `${actual} = ${expectedStr}`;
  }
  return `${actual} in ${eqlLiteralSet(list, castName)}`;
};

export const eqlLiteralSet = (items: Iterable<string>, castName?: string) => {
  const list = [...items];
  const listStr = list.map((i) => `'${i}'`).join(', ');
  return castName ? `<${castName}>{${listStr}}` : `{${listStr}}`;
};

export const fqnRelativeTo = (fqn: string, currentNamespace: string) => {
  const parts = fqn.split('::');
  const name = parts.pop()!;
  const givenNamespace = parts.join('::');
  return givenNamespace === currentNamespace ? name : fqn;
};
