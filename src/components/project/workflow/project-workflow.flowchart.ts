import { Injectable } from '@nestjs/common';
import { cacheable, cleanJoin, simpleSwitch } from '@seedcompany/common';
import open from 'open';
import * as uuid from 'uuid';
import { deflateSync as deflate } from 'zlib';
import { ProjectStep as Step } from '../dto';
import { Transitions } from './transitions';
import { DynamicStep } from './transitions/dynamic-step';

@Injectable()
export class ProjectWorkflowFlowchart {
  /** Generate a flowchart in mermaid markup. */
  generateMarkup() {
    const rgbHexAddAlpha = (rgb: string, alpha: number) =>
      rgb + alpha.toString(16).slice(2, 4);
    const colorStyle = (color: string) => ({
      fill: color,
      stroke: color.slice(0, 7),
    });
    const styles = {
      Approve: colorStyle(rgbHexAddAlpha('#23b800', 0.65)),
      Reject: colorStyle(rgbHexAddAlpha('#ff0000', 0.7)),
      Neutral: colorStyle(rgbHexAddAlpha('#000000', 0.17)),
      State: colorStyle(rgbHexAddAlpha('#00bcff', 0.58)),
      UnusedState: { fill: rgbHexAddAlpha('#00bcff', 0.58), stroke: '#ff0000' },
    };
    const dynamicToId = cacheable(new Map<DynamicStep, string>(), () =>
      uuid.v1().replaceAll(/-/g, ''),
    );
    const usedSteps = new Set<Step>();
    const useStep = (step: Step) => {
      usedSteps.add(step);
      return step;
    };

    const graph = cleanJoin('\n', [
      'flowchart TD',
      ...Object.values(Transitions).flatMap((t) => {
        const key = t.key.replaceAll(/-/g, '');
        const to =
          typeof t.to === 'string'
            ? `--> ${useStep(t.to)}`
            : t.to.relatedSteps
            ? `-."${t.to.description}".-> ${t.to.relatedSteps
                .map(useStep)
                .join(' & ')}`
            : `--> ${dynamicToId(t.to)}`;
        const conditions = t.conditions
          ? '--"' + t.conditions.map((c) => c.description).join('\\n') + '"'
          : '';
        const from = (t.from ? t.from.map(useStep) : ['*(*)']).join(' & ');
        return [
          `%% ${t.name}`,
          `${key}{{ ${t.label} }}:::${t.type}`,
          `${from} ${conditions}--- ${key} ${to}`,
          '',
        ].join('\n');
      }),
      '',
      ...[...Step].map((step) => {
        const { label } = Step.entry(step);
        const className = `${usedSteps.has(step) ? '' : 'Unused'}State`;
        return `${step}(${label}):::${className}`;
      }),
      '',
      ...Object.entries(styles).flatMap(([type, style]) => {
        const str = Object.entries(style)
          .map(([key, value]) => `${key}:${value}`)
          .join(',');
        return str ? `classDef ${type} ${str}` : [];
      }),
    ]);

    return graph;
  }

  /**
   * Copy mermaid markup of workflow to clipboard
   * ```bash
   * echo '$(ProjectWorkflowFlowchart).dump()' | LOG_LEVELS='*=error' yarn repl | pbcopy
   * ```
   */
  dump() {
    // eslint-disable-next-line no-console
    console.log(this.generateMarkup());
  }

  /**
   * Open a generated SVG of workflow in browser
   * ```bash
   * echo '$(ProjectWorkflowFlowchart).open()' | yarn repl
   * ```
   */
  open(type: 'edit' | 'view' | 'svg' = 'view') {
    const url = this.generateUrl(this.generateMarkup(), type);
    return open(url);
  }

  protected generateUrl(
    markup: string,
    type: 'edit' | 'view' | 'svg' = 'view',
    config = { theme: 'dark' },
  ) {
    const doc = {
      code: cleanJoin('\n', [
        // Can't figure out if this is needed or not.
        // `%%{ init: ${JSON.stringify(config)} }%`,
        markup,
      ]),
      mermaid: config,
    };
    const baseUrl = simpleSwitch(type, {
      view: 'https://mermaid.live/view#',
      edit: 'https://mermaid.live/edit#',
      svg: 'https://mermaid.ink/svg/',
    })!;
    const encoded =
      'pako:' +
      deflate(JSON.stringify(doc), { level: 9 })
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');
    return baseUrl + encoded;
  }
}
