import fs from 'node:fs/promises';
import { SchemaNode } from './ast-nodes';
import { Position } from './position';

export class SchemaFile extends SchemaNode {
  declare text: string;
  readonly path: string;

  static of(path: string, text = ''): SchemaFile {
    const pos = Position.full(text);
    const instance = SchemaNode.cast(
      SchemaFile,
      {
        text,
        outer: pos,
        inner: pos,
        parent: undefined,
        children: [],
        file: null as any, // circular reference assigned below
      },
      { path },
    );
    return Object.assign(instance, { file: instance });
  }

  async read() {
    this.text = await fs.readFile(this.path, 'utf8');
    const pos = Position.full(this.text);
    Object.assign(this, { outer: pos, inner: pos, children: [] });
  }
  async write(text?: string) {
    await fs.writeFile(this.path, text ?? this.text, 'utf8');
  }
}
