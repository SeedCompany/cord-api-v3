import * as crypto from 'crypto';
import fs from 'node:fs/promises';
import { SchemaNode } from './ast-nodes';
import { Position } from './position';

export class SchemaFile extends SchemaNode {
  readonly path: string;

  #textHash: string;
  #initHash: string;

  get text() {
    return super.text;
  }
  set text(value: string) {
    super.text = value;
    const pos = value ? Position.full(value) : Position.EMPTY;
    Object.assign(this, { outer: pos, inner: pos });
    this.#textHash = hash(value);
    this.#initHash ??= this.#textHash;
  }

  static of(path: string, text = ''): SchemaFile {
    const instance = SchemaNode.cast(
      SchemaFile,
      {
        text,
        outer: Position.EMPTY,
        inner: Position.EMPTY,
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
    this.#initHash = this.#textHash;
    // clear previously parsed children
    Object.assign(this, { children: [] });
  }
  async write(text?: string) {
    if (text != null) {
      this.text = text;
    }
    if (this.#textHash === this.#initHash) {
      return;
    }
    await fs.writeFile(this.path, this.text, 'utf8');
  }
}

const hash = (text: string) =>
  crypto.createHash('shake256', { outputLength: 5 }).update(text).digest('hex');
