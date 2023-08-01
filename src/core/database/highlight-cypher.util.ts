import chalk from 'chalk';
import Prism, { TokenObject } from 'prismjs';
import { highlight as cliHighlight } from 'prismjs-terminal';
import loadLanguages from 'prismjs/components/index.js';

export function highlight(query: string) {
  let pretty = cliHighlight(query, {
    language: 'cypher',
    padding: 0,
    theme,
  });
  pretty = pretty.split('\n').slice(0, -1).join('\n');
  return pretty;
}

loadLanguages('cypher');
// Fix `apoc.map.merge()` to being treated as a function call.
const cypher = Prism.languages.insertBefore('cypher', 'keyword', {
  // Adds period & removes space before parentheses
  function: /\b[\w.]+\b(?=\()/,
});
// Fix matching relationship labels without properties: `[:abc]`
(cypher['class-name'] as TokenObject).pattern =
  /(:\s*)(?:\w+|`[^`\\\r\n]*`)(?=\s*[{):]|])/;
// Remove "node" from keywords
cypher.keyword = RegExp(
  String(cypher.keyword).slice(1, -2).replace('|NODE', ''),
  'i',
);

const theme = {
  keyword: chalk.hex('#af63e5'),
  'class-name': chalk.hex('#ffc54d'),
  function: chalk.hex('#1c66ff'),
  'variable, boolean, number': chalk.hex('#F78C6C'),
  string: chalk.hex('#a0dc53'),
  'punctuation, operator': chalk.hex('#89DDFF'),
  comment: chalk.gray.italic,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  _: chalk.whiteBright,
};
