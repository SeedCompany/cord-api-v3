import type { ReadonlyVisitor } from '@nestjs/cli/lib/compiler/interfaces/readonly-visitor.interface';
import { hasDecorators } from '@nestjs/graphql/dist/plugin/utils/ast-utils.js';
import * as ts from 'typescript';

const securedKeys = ['value', 'canRead', 'canEdit'];

export class ResourceVisitor {
  constructor(readonly readonly = false) {}

  visit(sf: ts.SourceFile, ctx: ts.TransformationContext, program: ts.Program) {
    if (!sf.fileName.endsWith('dto.ts')) {
      return sf;
    }
    const { factory } = ctx;
    const visitNode = (node: ts.Node): ts.Node => {
      const decorators =
        (ts.canHaveDecorators(node) && ts.getDecorators(node)) || [];
      if (
        ts.isClassDeclaration(node) &&
        hasDecorators(decorators, ['RegisterResource'])
      ) {
        return this.enhanceDtoClass(node, program, factory);
      }

      if (this.readonly) {
        ts.forEachChild(node, visitNode);
      } else {
        return ts.visitEachChild(node, visitNode, ctx);
      }
      return node;
    };
    return ts.visitNode(sf, visitNode);
  }

  private enhanceDtoClass(
    classNode: ts.ClassDeclaration,
    program: ts.Program,
    factory: ts.NodeFactory,
  ) {
    const typeChecker = program.getTypeChecker();

    const classProps = typeChecker
      .getTypeAtLocation(classNode)
      .getApparentProperties();

    const securedProps = classProps.flatMap((member) => {
      const memberTypeProps = member.valueDeclaration
        ? typeChecker.getTypeAtLocation(member.valueDeclaration).getProperties()
        : [];

      const isSecured = securedKeys.every((securedKey) =>
        memberTypeProps.find((k) => k.getName() === securedKey),
      );
      return isSecured ? member : [];
    });

    return this.updateClassMembers(factory, classNode, [
      this.createStaticPropArray(factory, 'Props', classProps),
      this.createStaticPropArray(factory, 'SecuredProps', securedProps),
      ...classNode.members,
    ]);
  }

  private createStaticPropArray(
    factory: ts.NodeFactory,
    name: string,
    members: ts.Symbol[],
  ) {
    return factory.createPropertyDeclaration(
      [
        factory.createModifier(ts.SyntaxKind.StaticKeyword),
        factory.createModifier(ts.SyntaxKind.ReadonlyKeyword),
      ],
      factory.createIdentifier(name),
      undefined,
      undefined,
      factory.createArrayLiteralExpression(
        members.map((p) => factory.createStringLiteral(p.getName(), true)),
      ),
    );
  }

  private updateClassMembers(
    factory: ts.NodeFactory,
    classNode: ts.ClassDeclaration,
    newMembers: readonly ts.ClassElement[],
  ) {
    return factory.updateClassDeclaration(
      classNode,
      classNode.modifiers,
      classNode.name,
      classNode.typeParameters,
      classNode.heritageClauses,
      newMembers,
    );
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
