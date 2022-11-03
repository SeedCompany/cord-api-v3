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

export class ProgressReportHighlight extends PromptVariantResponse<
  VariantKeyOf<typeof Variant>
> {
  static Variants = variants;
}
