import type { ReadonlyVisitor } from '@nestjs/cli/lib/compiler/interfaces/readonly-visitor.interface';
import * as ts from 'typescript';

export class ResourceVisitor {
  constructor(readonly readonly = false) {}

  visit(sf: ts.SourceFile, ctx: ts.TransformationContext, program: ts.Program) {
    const visitNode = (node: ts.Node): ts.Node => {
      // TODO logic

      if (this.readonly) {
        ts.forEachChild(node, visitNode);
      } else {
        return ts.visitEachChild(node, visitNode, ctx);
      }
      return node;
    };
    return ts.visitNode(sf, visitNode);
  }
}

export class ResourceReadonlyVisitor implements ReadonlyVisitor {
  readonly key = '@cord/resources';
  private readonly visitor = new ResourceVisitor(true);

  get typeImports() {
    return {};
  }

  visit(program: ts.Program, sf: ts.SourceFile) {
    const factoryHost = { factory: ts.factory } as any;
    return this.visitor.visit(sf, factoryHost, program);
  }

  collect() {
    return {};
  }
}
