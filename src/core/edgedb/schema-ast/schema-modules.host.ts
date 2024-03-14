import { Injectable } from '@nestjs/common';
import { mapOf } from '@seedcompany/common';
import { glob } from 'glob';
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
    const filenames = await glob('./dbschema/*.esdl');
    const files = filenames.map((filename) =>
      SchemaFile.of(this.parser, filename),
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
