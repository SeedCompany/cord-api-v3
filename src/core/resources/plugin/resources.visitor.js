import { hasDecorators } from '@nestjs/graphql/dist/plugin/utils/ast-utils.js';
import * as ts from 'typescript';

const securedKeys = ['value', 'canRead', 'canEdit'];

export class ResourceVisitor {
  constructor(readonly = false) {
    this.readonly = readonly;
  }

  /**
   * @param sf {ts.SourceFile}
   * @param ctx {ts.TransformationContext}
   * @param program {ts.Program}
   * @returns {ts.Node}
   */
  visit(sf, ctx, program) {
    if (!sf.fileName.endsWith('dto.ts')) {
      return sf;
    }
    const { factory } = ctx;
    /**
     * @param node {ts.Node}
     * @returns {ts.Node}
     */
    const visitNode = (node) => {
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

  /**
   * @param classNode {ts.ClassDeclaration}
   * @param program {ts.Program}
   * @param factory {ts.NodeFactory}
   * @returns {ts.ClassDeclaration}
   */
  enhanceDtoClass(classNode, program, factory) {
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

  /**
   * @param factory {ts.NodeFactory}
   * @param name {string}
   * @param members {ts.Symbol[]}
   * @returns {ts.PropertyDeclaration}
   */
  createStaticPropArray(factory, name, members) {
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

  /**
   * @param factory {ts.NodeFactory}
   * @param classNode {ts.ClassDeclaration}
   * @param newMembers {readonly ts.ClassElement[]}
   * @returns {ts.ClassDeclaration}
   */
  updateClassMembers(factory, classNode, newMembers) {
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

export class ResourceReadonlyVisitor {
  key = '@cord/resources';
  visitor = new ResourceVisitor(true);

  get typeImports() {
    return {};
  }

  /**
   * @param program {ts.Program}
   * @param sf {ts.SourceFile}
   * @returns {ts.Node}
   */
  visit(program, sf) {
    /** @type {*} */
    const factoryHost = { factory: ts.factory };
    return this.visitor.visit(sf, factoryHost, program);
  }

  collect() {
    return {};
  }
}
