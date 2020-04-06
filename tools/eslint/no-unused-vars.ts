/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-var-requires */
import {
  ReportDescriptor,
  RuleModule,
} from '@typescript-eslint/experimental-utils/dist/ts-eslint/Rule';
import {
  BaseNode,
  Comment,
  ImportDeclaration,
  ImportDefaultSpecifier,
  ImportSpecifier as ImportNamedSpecifier,
  Node,
  Token,
} from '@typescript-eslint/typescript-estree/dist/ts-estree/ts-estree';
// prettier-ignore
const { default: baseRule } = require('@typescript-eslint/eslint-plugin/dist/rules/no-unused-vars-experimental');

type ImportSpecifier = ImportNamedSpecifier | ImportDefaultSpecifier;

export const noUnusedVars: RuleModule<string, any[]> = {
  meta: {
    ...baseRule.meta,
    fixable: 'code',
  },
  create(context) {
    /* eslint-disable @typescript-eslint/unbound-method */
    const report = (descriptor: ReportDescriptor<string>) => {
      const node = (descriptor as any).node as Node;
      if (!node) {
        return;
      }
      if (
        !isImportDeclaration(node) &&
        (!node.parent || !isImportSpecifier(node.parent))
      ) {
        context.report(descriptor);
        return;
      }

      descriptor.fix = (fixer) => {
        if (isImportDeclaration(node)) {
          return fixer.remove(node);
        }

        const sourceCode = context.getSourceCode();
        const unusedImport = node.parent as ImportSpecifier;
        const declaration = unusedImport.parent as ImportDeclaration;
        const { specifiers: imports } = declaration;

        const removeBetween = (start: BaseNode | null, end: BaseNode | null) =>
          start && end
            ? fixer.removeRange([start.range[0], end.range[1]])
            : null;

        // Import is not last, remove it and the following comma
        if (unusedImport !== imports[imports.length - 1]) {
          return removeBetween(
            unusedImport,
            sourceCode.getTokenAfter(unusedImport, isComma)
          );
        }

        // Import is only named import following a default import
        // ex. "import default, { unused } from 'module';"
        if (imports.filter(isNamedImportSpecifier).length === 1) {
          return removeBetween(
            sourceCode.getTokenBefore(unusedImport, isComma),
            sourceCode.getTokenAfter(unusedImport, isClosingBracket)
          );
        }

        // Import is last, remove it and the comma before it
        return removeBetween(
          sourceCode.getTokenBefore(unusedImport, isComma),
          unusedImport
        );
      };

      context.report(descriptor);
    };

    return baseRule.create({
      ...context,
      options: context.options,
      parserServices: context.parserServices,
      report,
    });
  },
};

const isImportDeclaration = (node: Node): node is ImportDeclaration =>
  node.type === 'ImportDeclaration';

const isImportSpecifier = (node: Node) =>
  isNamedImportSpecifier(node) || isDefaultImportSpecifier(node);

const isNamedImportSpecifier = (node: Node): node is ImportSpecifier =>
  node.type === 'ImportSpecifier';

const isDefaultImportSpecifier = (node: Node): node is ImportDefaultSpecifier =>
  node.type === 'ImportDefaultSpecifier';

const isComma = (token: Token | Comment) => token.value === ',';

const isClosingBracket = (token: Token | Comment) => token.value === '}';
