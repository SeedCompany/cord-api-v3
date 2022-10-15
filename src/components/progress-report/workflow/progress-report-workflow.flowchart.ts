import { Injectable } from '@nestjs/common';
import { startCase } from 'lodash';
import { ProgressReportStatus as Status } from '../dto';
import { Transitions } from './transitions';

@Injectable()
export class ProgressReportWorkflowFlowchart {
  /** Generate a flowchart in mermaid markup. */
  generate() {
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
    };
    const config = {
      // theme: 'base',
      // themeVariables: {
      //   primaryColor: '#ff0000',
      // },
    };
    const graph = [
      `%%${JSON.stringify({ init: config })}%%`,
      'flowchart TD',
      ...Object.entries(styles).flatMap(([type, style]) => {
        const str = Object.entries(style)
          .map(([key, value]) => `${key}:${value}`)
          .join(',');
        return str ? `classDef ${type} ${str}` : [];
      }),
      '',
      ...Object.keys(Status).map(
        (status) => `${status}(${startCase(status)}):::State`
      ),
      '',
      ...Object.values(Transitions).flatMap((t) => {
        return [
          `%% ${t.name}`,
          `${t.id}{{ ${t.label} }}:::${t.type}`,
          ...(t.from ?? ['*(*)']).map((f) => `${f} --- ${t.id} --> ${t.to}`),
          '',
        ].join('\n');
      }),
    ].join('\n');

    return graph;
  }

  dump() {
    // eslint-disable-next-line no-console
    console.log(this.generate());
  }
}
