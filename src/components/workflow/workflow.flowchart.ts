import {
  cacheable,
  cleanJoin,
  entries,
  simpleSwitch,
} from '@seedcompany/common';
import open from 'open';
import * as uuid from 'uuid';
import { deflateSync as deflate } from 'zlib';
import { MadeEnum, ResourceShape } from '~/common';
import { WorkflowEvent as WorkflowEventFn } from './dto';
import { InternalTransition } from './transitions';
import { DynamicState } from './transitions/dynamic-state';

type WorkflowEvent = ReturnType<typeof WorkflowEventFn>['prototype'];

export const WorkflowFlowchart = <
  State extends string,
  Names extends string,
  Context,
  EventClass extends ResourceShape<WorkflowEvent>,
>(
  stateEnum: MadeEnum<State>,
  transitions: Record<Names, InternalTransition<State, Names, Context>>,
  eventResource: EventClass,
) => {
  abstract class WorkflowFlowchartClass {
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
        UnusedState: {
          fill: rgbHexAddAlpha('#00bcff', 0.58),
          stroke: '#ff0000',
        },
      };
      const dynamicToId = cacheable(
        new Map<DynamicState<State, Context>, string>(),
        () => uuid.v1().replaceAll(/-/g, ''),
      );
      const usedStates = new Set<State>();
      const useState = (state: State) => {
        usedStates.add(state);
        return state;
      };

      const graph = cleanJoin('\n', [
        'flowchart TD',
        ...entries(transitions).flatMap(([_, t]) => {
          const key = t.key.replaceAll(/-/g, '');
          const to =
            typeof t.to === 'string'
              ? `--> ${useState(t.to)}`
              : t.to.relatedStates
              ? `-."${t.to.description}".-> ${t.to.relatedStates
                  .map(useState)
                  .join(' & ')}`
              : `--> ${dynamicToId(t.to)}`;
          const conditions = t.conditions
            ? '--"' + t.conditions.map((c) => c.description).join('\\n') + '"'
            : '';
          const from = (t.from ? [...t.from].map(useState) : ['*(*)']).join(
            ' & ',
          );
          return [
            `%% ${t.name}`,
            `${key}{{ ${t.label} }}:::${t.type}`,
            `${from} ${conditions}--- ${key} ${to}`,
            '',
          ].join('\n');
        }),
        '',
        ...[...stateEnum].map((state) => {
          const { label } = stateEnum.entry(state);
          const className = `${usedStates.has(state) ? '' : 'Unused'}State`;
          return `${state}(${label}):::${className}`;
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
     * echo '$(...WorkflowFlowchart).dump()' | LOG_LEVELS='*=error' yarn repl | pbcopy
     * ```
     */
    dump() {
      // eslint-disable-next-line no-console
      console.log(this.generateMarkup());
    }

    /**
     * Open a generated SVG of workflow in browser
     * ```bash
     * echo '$(...WorkflowFlowchart).open()' | yarn repl
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
        mermaid: JSON.stringify(config),
        panZoom: true,
        rough: false,
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
  return WorkflowFlowchartClass;
};
