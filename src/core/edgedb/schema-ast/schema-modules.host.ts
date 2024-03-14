import { Injectable } from '@nestjs/common';
import { mapOf } from '@seedcompany/common';
import fs from 'node:fs/promises';
import * as path from 'path';
import { SchemaNode, SchemaType } from './ast-nodes';
import { CrudeAstParser } from './crude-ast-parser';
import { SchemaFile } from './schema-file';

@Injectable()
export class SchemaModulesHost {
  constructor(private readonly parser: CrudeAstParser) {}

  async buildAstByFQNs() {
    const files = await this.discoverFiles();
    const maps = files.map((file) => this.discoverTypes(file));
    const types = mapOf(maps.flatMap((map) => [...map]));
    return types;
  }

  private async discoverFiles() {
    const directoryPath = './dbschema';
    const filenames = await fs.readdir(directoryPath);
    const files = filenames.flatMap((filename) =>
      filename.endsWith('.esdl')
        ? SchemaFile.of(this.parser, path.join(directoryPath, filename))
        : [],
    );
    await Promise.all(files.map((file) => file.read()));
    return files;
  }

  private discoverTypes(file: SchemaFile) {
    const byFQN = new Map<string, SchemaType>();
    const walk = (node: SchemaNode) => {
      if (node instanceof SchemaType) {
        byFQN.set(node.getFQN(), node);
        return;
      }
      for (const child of node.children) {
        walk(child);
      }
    };
    walk(file.parse());

    return byFQN;
  }
}
