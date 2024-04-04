import { FnLike } from '@seedcompany/common';
import { ConditionalExcept, Except } from 'type-fest';
import { Position } from './position';
import type { SchemaFile } from './schema-file';

export class SchemaNode {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  private _text: string;
  get text() {
    return this._text;
  }
  protected set text(value: string) {
    this._text = value;
  }

  readonly outer: Position;
  readonly inner: Position | null;

  readonly file: SchemaFile;
  readonly parent: SchemaNode | undefined;
  readonly children: readonly SchemaNode[];

  ancestors(): readonly SchemaNode[] {
    const ancestors = [];
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    let current: SchemaNode = this;
    while (current.parent) {
      ancestors.push(current.parent);
      current = current.parent;
    }
    return ancestors;
  }

  descendants(): SchemaNode[] {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }

  static from(input: ConditionalExcept<SchemaNode, FnLike>) {
    return SchemaNode.cast(SchemaNode, input, {});
  }
  static cast<Node extends SchemaNode>(
    type: { prototype: Node },
    input: ConditionalExcept<SchemaNode, FnLike>,
    extra: ConditionalExcept<Except<Node, keyof SchemaNode>, FnLike>,
  ): Node {
    const target: Node = new (type as any)();
    return Object.assign(target, extra, input);
  }
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  protected constructor() {}
}

export class SchemaModule extends SchemaNode {
  readonly name: string;

  getNamespace() {
    const parentNames = this.ancestors().flatMap((node) =>
      node instanceof SchemaModule ? node.name : [],
    );
    const fqn = [...parentNames, this.name].join('::');
    return fqn;
  }
}

export class SchemaType extends SchemaNode {
  readonly name: string;

  getModule() {
    if (!(this.parent instanceof SchemaModule)) {
      throw new Error('Expected parent to be a module');
    }
    return this.parent;
  }

  getFQN() {
    const fqn = [this.getModule().getNamespace(), this.name].join('::');
    return fqn;
  }
}
