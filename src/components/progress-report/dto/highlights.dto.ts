import { keys as keysOf } from 'ts-transformer-keys';
import { SecuredProps, Variant, VariantOf } from '~/common';
import { e } from '~/core/edgedb';
import { RegisterResource } from '~/core/resources';
import { Role } from '../../authorization';
import { PromptVariantResponse } from '../../prompts/dto';

const variants = Variant.createList({
  draft: {
    label: `Partner`,
    responsibleRole: Role.FieldPartner,
  },
  translated: {
    label: `Translation`,
    responsibleRole: Role.Translator,
  },
  fpm: {
    label: `Field Operations`,
    responsibleRole: Role.ProjectManager,
  },
  published: {
    label: `Investor Communications`,
    responsibleRole: Role.Marketing,
  },
});

@RegisterResource({ db: e.ProgressReport.Highlight })
export class ProgressReportHighlight extends PromptVariantResponse<HighlightVariant> {
  static Props = keysOf<ProgressReportHighlight>();
  static SecuredProps = keysOf<SecuredProps<ProgressReportHighlight>>();
  static readonly Parent = import('./progress-report.entity').then(
    (m) => m.ProgressReport,
  );
  static Variants = variants;
  static readonly ConfirmThisClassPassesSensitivityToPolicies = true;
}

export type HighlightVariant = VariantOf<typeof ProgressReportHighlight>;

declare module '~/core/resources/map' {
  interface ResourceMap {
    ProgressReportHighlight: typeof ProgressReportHighlight;
  }
  interface ResourceDBMap {
    ProgressReportHighlight: typeof e.ProgressReport.Highlight;
  }
}
