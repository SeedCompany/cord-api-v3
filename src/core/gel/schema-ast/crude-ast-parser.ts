import { Injectable } from '@nestjs/common';
import { Nil } from '@seedcompany/common';
import XRegExp from 'xregexp';
import { SchemaModule, SchemaNode, SchemaType } from './ast-nodes';
import { Position } from './position';
import type { SchemaFile } from './schema-file';

@Injectable()
export class CrudeAstParser {
  parse(file: SchemaFile) {
    return this.parseNode(file) as SchemaFile;
  }

  private parseNode(input: SchemaNode): SchemaNode {
    const parentText = input.inner?.sliceOf(input.file.text) ?? input.file.text;
    const parentStart = input.inner ?? input.file.outer;

    const rawBlocks = this.segmentBlocks(parentText);
    const children = rawBlocks.map(({ outer, inner, self }) => {
      const outerAbsOffset = Position.within(outer, parentText).shift(
        parentStart,
      );
      const innerAbsOffset = inner
        ? Position.within(inner, outer).shift(outerAbsOffset)
        : null;

      const rawChild = SchemaNode.from({
        file: input.file,
        parent: input,
        children: [] as const,
        text: self,
        outer: outerAbsOffset,
        inner: innerAbsOffset,
      });
      const child = this.enhanceNode(rawChild);

      inner != null && this.parseNode(child);

      return child;
    });

    const out: SchemaNode = Object.assign(input, { children });
    return out;
  }

  private enhanceNode(node: SchemaNode) {
    const subClass = this.nodeFactory(node);
    return subClass ? SchemaNode.cast(subClass[0], node, subClass[1]) : node;
  }

  private nodeFactory(
    input: SchemaNode,
  ):
    | readonly [type: { prototype: SchemaNode }, extra: Record<string, any>]
    | Nil {
    const module = /^module\s+(\S+)/i.exec(input.text);
    if (module) {
      return [SchemaModule, { name: module[1] }];
    }

    const type = /^(?:abstract\s+)?type\s+(?!:=)(\S+)/i.exec(input.text);
    if (type) {
      return [SchemaType, { name: type[1] }];
    }

    return null;
  }

  private segmentBlocks(text: string) {
    // Find block bodies 1 level deep
    const blockBodies = XRegExp.matchRecursive(text, '\\{', '\\}', 'g');

    // Remove nested bodies, so the block split does not consider
    const bodiesStripped = blockBodies.reduce((stripped, body) => {
      if (body === '') {
        return stripped;
      }
      const prefixIdx = stripped.indexOf(body);
      let suffixIdx = prefixIdx + (body.length + 1);
      if (stripped[suffixIdx + 1] !== ';') {
        suffixIdx++;
      }
      return stripped.slice(0, prefixIdx) + '};' + stripped.slice(suffixIdx);
    }, text);

    const statements = bodiesStripped
      // Ensure empty bodies have a semicolon
      .replaceAll(/{}(?!;)/g, '{};')
      .split(';');

    let stubbedBlockIdx = -1;
    return statements.flatMap((prefix) => {
      if (!prefix.trim()) {
        return [];
      }

      const body = prefix.endsWith('{}')
        ? blockBodies[++stubbedBlockIdx]
        : null;

      // strip leading empty lines
      let block = prefix.replace(/^\s*\n/, '');

      // the block's own text, disregarding the body/children
      const self = (block.endsWith('{}') ? block.slice(0, -2) : block).trim();

      // Reinstate the body if it was stripped
      if (body != null) {
        block = block.slice(0, -1) + body + '}';
      }

      // Add suffix to outer block.
      // This could be a semicolon, a trailing comment, and or a line break
      const suffixStartIdx = text.indexOf(block) + block.length;
      const suffixLineBreakAt = text.indexOf('\n', suffixStartIdx);
      const suffix = text.slice(suffixStartIdx, suffixLineBreakAt + 1);
      block += suffix;

      // If body is empty, don't consider it moving forward
      // also trim leading new lines & trailing spaces
      const inner = body?.replace(/^\s*\n/, '').replace(/\n\s*$/, '\n') || null;

      return { self, outer: block, inner };
    });
  }
}
