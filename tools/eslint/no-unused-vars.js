"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// prettier-ignore
const { default: baseRule } = require('@typescript-eslint/eslint-plugin/dist/rules/no-unused-vars-experimental');
exports.noUnusedVars = {
    meta: {
        ...baseRule.meta,
        fixable: 'code',
    },
    create(context) {
        /* eslint-disable @typescript-eslint/unbound-method */
        const report = (descriptor) => {
            const node = descriptor.node;
            if (!node) {
                return;
            }
            if (!isImportDeclaration(node) &&
                (!node.parent || !isImportSpecifier(node.parent))) {
                context.report(descriptor);
                return;
            }
            descriptor.fix = fixer => {
                if (isImportDeclaration(node)) {
                    return fixer.remove(node);
                }
                const sourceCode = context.getSourceCode();
                const unusedImport = node.parent;
                const declaration = unusedImport.parent;
                const { specifiers: imports } = declaration;
                const removeBetween = (start, end) => start && end
                    ? fixer.removeRange([start.range[0], end.range[1]])
                    : null;
                // Import is not last, remove it and the following comma
                if (unusedImport !== imports[imports.length - 1]) {
                    return removeBetween(unusedImport, sourceCode.getTokenAfter(unusedImport, isComma));
                }
                // Import is only named import following a default import
                // ex. "import default, { unused } from 'module';"
                if (imports.filter(isNamedImportSpecifier).length === 1) {
                    return removeBetween(sourceCode.getTokenBefore(unusedImport, isComma), sourceCode.getTokenAfter(unusedImport, isClosingBracket));
                }
                // Import is last, remove it and the comma before it
                return removeBetween(sourceCode.getTokenBefore(unusedImport, isComma), unusedImport);
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
const isImportDeclaration = (node) => node.type === 'ImportDeclaration';
const isImportSpecifier = (node) => isNamedImportSpecifier(node) || isDefaultImportSpecifier(node);
const isNamedImportSpecifier = (node) => node.type === 'ImportSpecifier';
const isDefaultImportSpecifier = (node) => node.type === 'ImportDefaultSpecifier';
const isComma = (token) => token.value === ',';
const isClosingBracket = (token) => token.value === '}';
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibm8tdW51c2VkLXZhcnMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJuby11bnVzZWQtdmFycy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQWNBLGtCQUFrQjtBQUNsQixNQUFNLEVBQUUsT0FBTyxFQUFFLFFBQVEsRUFBRSxHQUFHLE9BQU8sQ0FBQyx5RUFBeUUsQ0FBQyxDQUFDO0FBSXBHLFFBQUEsWUFBWSxHQUE4QjtJQUNyRCxJQUFJLEVBQUU7UUFDSixHQUFHLFFBQVEsQ0FBQyxJQUFJO1FBQ2hCLE9BQU8sRUFBRSxNQUFNO0tBQ2hCO0lBQ0QsTUFBTSxDQUFDLE9BQU87UUFDWixzREFBc0Q7UUFDdEQsTUFBTSxNQUFNLEdBQUcsQ0FBQyxVQUFvQyxFQUFFLEVBQUU7WUFDdEQsTUFBTSxJQUFJLEdBQUksVUFBa0IsQ0FBQyxJQUFZLENBQUM7WUFDOUMsSUFDRSxDQUFDLG1CQUFtQixDQUFDLElBQUksQ0FBQztnQkFDMUIsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLENBQUMsRUFDakQ7Z0JBQ0EsT0FBTyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQztnQkFDM0IsT0FBTzthQUNSO1lBRUQsVUFBVSxDQUFDLEdBQUcsR0FBRyxLQUFLLENBQUMsRUFBRTtnQkFDdkIsSUFBSSxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsRUFBRTtvQkFDN0IsT0FBTyxLQUFLLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxDQUFDO2lCQUMzQjtnQkFFRCxNQUFNLFVBQVUsR0FBRyxPQUFPLENBQUMsYUFBYSxFQUFFLENBQUM7Z0JBQzNDLE1BQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxNQUF5QixDQUFDO2dCQUNwRCxNQUFNLFdBQVcsR0FBRyxZQUFZLENBQUMsTUFBMkIsQ0FBQztnQkFDN0QsTUFBTSxFQUFFLFVBQVUsRUFBRSxPQUFPLEVBQUUsR0FBRyxXQUFXLENBQUM7Z0JBRTVDLE1BQU0sYUFBYSxHQUFHLENBQUMsS0FBc0IsRUFBRSxHQUFvQixFQUFFLEVBQUUsQ0FDckUsS0FBSyxJQUFJLEdBQUc7b0JBQ1YsQ0FBQyxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztvQkFDbkQsQ0FBQyxDQUFDLElBQUksQ0FBQztnQkFFWCx3REFBd0Q7Z0JBQ3hELElBQUksWUFBWSxLQUFLLE9BQU8sQ0FBQyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxFQUFFO29CQUNoRCxPQUFPLGFBQWEsQ0FDbEIsWUFBWSxFQUNaLFVBQVUsQ0FBQyxhQUFhLENBQUMsWUFBWSxFQUFFLE9BQU8sQ0FBQyxDQUNoRCxDQUFDO2lCQUNIO2dCQUVELHlEQUF5RDtnQkFDekQsa0RBQWtEO2dCQUNsRCxJQUFJLE9BQU8sQ0FBQyxNQUFNLENBQUMsc0JBQXNCLENBQUMsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO29CQUN2RCxPQUFPLGFBQWEsQ0FDbEIsVUFBVSxDQUFDLGNBQWMsQ0FBQyxZQUFZLEVBQUUsT0FBTyxDQUFDLEVBQ2hELFVBQVUsQ0FBQyxhQUFhLENBQUMsWUFBWSxFQUFFLGdCQUFnQixDQUFDLENBQ3pELENBQUM7aUJBQ0g7Z0JBRUQsb0RBQW9EO2dCQUNwRCxPQUFPLGFBQWEsQ0FDbEIsVUFBVSxDQUFDLGNBQWMsQ0FBQyxZQUFZLEVBQUUsT0FBTyxDQUFDLEVBQ2hELFlBQVksQ0FDYixDQUFDO1lBQ0osQ0FBQyxDQUFDO1lBRUYsT0FBTyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUM3QixDQUFDLENBQUM7UUFFRixPQUFPLFFBQVEsQ0FBQyxNQUFNLENBQUM7WUFDckIsR0FBRyxPQUFPO1lBQ1YsT0FBTyxFQUFFLE9BQU8sQ0FBQyxPQUFPO1lBQ3hCLGNBQWMsRUFBRSxPQUFPLENBQUMsY0FBYztZQUN0QyxNQUFNO1NBQ1AsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztDQUNGLENBQUM7QUFFRixNQUFNLG1CQUFtQixHQUFHLENBQUMsSUFBVSxFQUE2QixFQUFFLENBQ3BFLElBQUksQ0FBQyxJQUFJLEtBQUssbUJBQW1CLENBQUM7QUFFcEMsTUFBTSxpQkFBaUIsR0FBRyxDQUFDLElBQVUsRUFBRSxFQUFFLENBQ3ZDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxJQUFJLHdCQUF3QixDQUFDLElBQUksQ0FBQyxDQUFDO0FBRWpFLE1BQU0sc0JBQXNCLEdBQUcsQ0FBQyxJQUFVLEVBQTJCLEVBQUUsQ0FDckUsSUFBSSxDQUFDLElBQUksS0FBSyxpQkFBaUIsQ0FBQztBQUVsQyxNQUFNLHdCQUF3QixHQUFHLENBQUMsSUFBVSxFQUFrQyxFQUFFLENBQzlFLElBQUksQ0FBQyxJQUFJLEtBQUssd0JBQXdCLENBQUM7QUFFekMsTUFBTSxPQUFPLEdBQUcsQ0FBQyxLQUFzQixFQUFFLEVBQUUsQ0FBQyxLQUFLLENBQUMsS0FBSyxLQUFLLEdBQUcsQ0FBQztBQUVoRSxNQUFNLGdCQUFnQixHQUFHLENBQUMsS0FBc0IsRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDLEtBQUssS0FBSyxHQUFHLENBQUMifQ==
