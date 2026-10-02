import { Role, Variant, type VariantOf } from '~/common';
import { RegisterResource } from '~/core/resources';
import { PromptVariantResponse } from '../../prompts/dto';

/**
 * The audience stages a GTL narrative passes through — the same four Momentum
 * uses, in the same order, with the first relabelled for who writes it: a
 * Global Translation Leader rather than a partner organization.
 *
 * `translated` is not gated on the report's workflow status: a variant is
 * visible to whoever holds its responsible role, in every status. The
 * `PendingTranslation` state says a translation is *awaited*; this variant is
 * where it lands.
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

/**
 * "Please share a story, testimony, or incident…" — the leader's account of
 * what Bible translation and the internship have meant around them.
 */
@RegisterResource()
export class GtlReportCommunityImpact extends PromptVariantResponse<GtlProseVariant> {
  static readonly Parent = () =>
    import('./gtl-report.dto').then((m) => m.GTLReport);
  static Variants = variants;
  static readonly ConfirmThisClassPassesSensitivityToPolicies = true;
}

/** The quarter's high points, in the leader's own words. */
@RegisterResource()
export class GtlReportHighlight extends PromptVariantResponse<GtlProseVariant> {
  static readonly Parent = () =>
    import('./gtl-report.dto').then((m) => m.GTLReport);
  static Variants = variants;
  static readonly ConfirmThisClassPassesSensitivityToPolicies = true;
}

export type GtlProseVariant = VariantOf<typeof GtlReportCommunityImpact>;

declare module '~/core/resources/map' {
  interface ResourceMap {
    GtlReportCommunityImpact: typeof GtlReportCommunityImpact;
    GtlReportHighlight: typeof GtlReportHighlight;
  }
}
