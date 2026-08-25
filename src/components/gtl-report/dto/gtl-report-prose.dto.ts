import { Role, Variant, type VariantOf } from '~/common';
import { RegisterResource } from '~/core/resources';
import { PromptVariantResponse } from '../../prompts/dto';

/**
 * The audience stages a GTL narrative passes through.
 *
 * Shorter than Momentum's four: there is no separate translation stage owned by
 * a Translator role here — a GTL narrative arriving in a national language is
 * handled by the report's `PendingTranslation` workflow state rather than by a
 * distinct response variant.
 *
 * `published` MUST stay last. Downstream code treats the final variant as the
 * public one positionally (see `ProgressReportMedia.PublicVariants`), and
 * seed-api selects investor-facing prose by the literal key `published`.
 */
const variants = Variant.createList({
  draft: {
    label: `Global Leader`,
    responsibleRole: Role.FieldPartner,
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

/** "Please share any stories, testimonies, or incidents…" */
@RegisterResource()
export class GtlReportCommunityImpact extends PromptVariantResponse<GtlProseVariant> {
  static readonly Parent = () =>
    import('./gtl-report.dto').then((m) => m.GTLReport);
  static Variants = variants;
  static readonly ConfirmThisClassPassesSensitivityToPolicies = true;
}

/** "Praises — What are you thankful for?" */
@RegisterResource()
export class GtlReportPraise extends PromptVariantResponse<GtlProseVariant> {
  static readonly Parent = () =>
    import('./gtl-report.dto').then((m) => m.GTLReport);
  static Variants = variants;
  static readonly ConfirmThisClassPassesSensitivityToPolicies = true;
}

/** "Petitions — What needs do you have?" */
@RegisterResource()
export class GtlReportPetition extends PromptVariantResponse<GtlProseVariant> {
  static readonly Parent = () =>
    import('./gtl-report.dto').then((m) => m.GTLReport);
  static Variants = variants;
  static readonly ConfirmThisClassPassesSensitivityToPolicies = true;
}

export type GtlProseVariant = VariantOf<typeof GtlReportCommunityImpact>;

declare module '~/core/resources/map' {
  interface ResourceMap {
    GtlReportCommunityImpact: typeof GtlReportCommunityImpact;
    GtlReportPraise: typeof GtlReportPraise;
    GtlReportPetition: typeof GtlReportPetition;
  }
}
