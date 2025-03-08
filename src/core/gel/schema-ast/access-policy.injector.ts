import { Injectable } from '@nestjs/common';
import { glob } from 'glob';
import addIndent from 'indent-string';
import { EnhancedResource } from '~/common';
import { ResourcesHost } from '~/core/resources';
import { GelAccessPolicyGenerator } from '../../../components/authorization/policy/gel-access-policy.generator';
import { SchemaType } from './ast-nodes';
import { CrudeAstParser } from './crude-ast-parser';
import { SchemaFile } from './schema-file';

@Injectable()
export class GelAccessPolicyInjector {
  constructor(
    private readonly resources: ResourcesHost,
    private readonly parser: CrudeAstParser,
    private readonly generator: GelAccessPolicyGenerator,
  ) {}

  async inject() {
    const files = await this.discoverFiles();
    await this.injectAll(files);
  }

  async eject() {
    const files = await this.discoverFiles();
    await this.ejectAll(files);
  }

  async injectAll(files: SchemaFile[]) {
    await Promise.all(files.map((file) => this.injectForFile(file).write()));
  }

  async ejectAll(files: SchemaFile[]) {
    await Promise.all(files.map((file) => this.ejectFile(file).write()));
  }

  async discoverFiles() {
    const filenames = await glob('./dbschema/*.gel');
    const files = filenames.map((filename) =>
      SchemaFile.of(this.parser, filename),
    );
    await Promise.all(files.map((file) => file.read()));
    return files;
  }

  private injectForFile(file: SchemaFile) {
    this.ejectFile(file);

    const types = file
      .parse()
      .descendants()
      .flatMap((node) => (node instanceof SchemaType ? node : []))
      // Sort by last spot in file first, very important.
      // So that subsequent injections don't need their positions refreshed.
      .reverse();

    for (const node of types) {
      const resource = this.resources.byEdgeFQN.get(node.getFQN());
      if (resource) {
        this.injectForType(node, resource);
      }
    }

    return file;
  }

  private injectForType(node: SchemaType, resource: EnhancedResource<any>) {
    const policies = this.generator.makeSdl({
      resource,
      namespace: node.getModule().getNamespace(),
    });
    if (!policies) {
      return;
    }

    // num parents determines indent. exclude file. add for inner
    const indentCount = node.ancestors().length - 1 + 1;

    const indentedPolicies =
      addIndent(policies, indentCount, { indent: '  ' }) + '\n';

    if (node.inner) {
      node.file.insertAfter(node.inner, '\n' + indentedPolicies);
    } else {
      // `type X;` -> `type X { ...policies... };`
      const newBlock = ` {\n${addIndent('}', indentCount - 1, {
        indent: '  ',
      })}`;
      node.file
        .insertAt(node.outer.end - 2, newBlock)
        .insertAt(node.outer.end + 1, indentedPolicies);
    }
  }

  private ejectFile(file: SchemaFile) {
    return file.replaceText((text) =>
      text
        .replaceAll(
          /\n? *access policy Can\w+GeneratedFromAppPolicies[^;]+;\n/g,
          '',
        )
        .replaceAll(/ {\s*};/g, ';'),
    );
  }
}
