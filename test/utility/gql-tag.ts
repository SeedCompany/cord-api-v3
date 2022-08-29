/**
 * A no-op tag to provide syntax highlighting.
 */
export const gql = (doc: TemplateStringsArray, ...rest: string[]) => {
  let result = doc[0];
  for (let i = 1, l = doc.length; i < l; i++) {
    result += rest[i - 1];
    result += doc[i];
  }
  return result;
};
