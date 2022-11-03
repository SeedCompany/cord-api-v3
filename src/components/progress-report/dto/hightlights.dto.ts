import { keys as keysOf } from 'ts-transformer-keys';
import { SecuredProps } from '~/common';
import { RegisterResource } from '~/core';
import { Role } from '../../authorization';
import { PromptVariantResponse } from '../../prompts/dto';
import { Variant, VariantKeyOf } from '../../prompts/dto/variant.dto';

const variants = Variant.createList({
  draft: {
    label: `Partner's Entry`,
    responsibleRole: Role.FieldPartner,
  },
  translated: {
    label: `Translation`,
    responsibleRole: Role.Translator,
  },
  fpm: {
    label: `Field Project Manager Notes`,
    responsibleRole: Role.ProjectManager,
  },
  published: {
    label: `Published Version`,
    responsibleRole: Role.Marketing,
  },
});

@RegisterResource()
export class ProgressReportHighlight extends PromptVariantResponse<
  VariantKeyOf<typeof Variant>
> {
  static Props = keysOf<ProgressReportHighlight>();
  static SecuredProps = keysOf<SecuredProps<ProgressReportHighlight>>();
  static Parent = import('./progress-report.entity').then(
    (m) => m.ProgressReport
  );
  static Variants = variants;
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    ProgressReportHighlight: typeof ProgressReportHighlight;
  }
}
