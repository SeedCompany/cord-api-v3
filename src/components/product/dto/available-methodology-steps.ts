import { Field, ObjectType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { keys } from '../../../common';
import { MethodologyStep as Step } from './methodology-step.enum';
import { ProductApproach as Approach } from './product-approach';
import {
  ApproachToMethodologies,
  ProductMethodology as Methodology,
} from './product-methodology';

type StepMap = Record<Methodology, Step[]>;

const steps = (approach: Approach | Methodology[], steps: Step[]): StepMap =>
  Object.assign(
    {},
    ...(Array.isArray(approach)
      ? approach
      : ApproachToMethodologies[approach]
    ).map((m) => ({
      [m]: steps,
    }))
  );

export const MethodologyAvailableSteps: StepMap = {
  // default fallback
  ...steps(keys<Methodology>(Methodology), [Step.Completed]),
  ...steps(Approach.Written, [
    Step.ExegesisAndFirstDraft,
    Step.TeamCheck,
    Step.CommunityTesting,
    Step.BackTranslation,
    Step.ConsultantCheck,
    Step.Completed,
  ]),
  ...steps(Approach.OralTranslation, [
    Step.InternalizationAndDrafting,
    Step.PeerRevision,
    Step.CommunityTesting,
    Step.BackTranslation,
    Step.ConsultantCheck,
    Step.ConsistencyCheckAndFinalEdits,
    Step.Completed,
  ]),
  ...steps(Approach.OralStories, [
    Step.Craft,
    Step.Test,
    Step.Check,
    Step.Record,
    Step.Completed,
  ]),
};

@ObjectType({
  description: stripIndent`
    Describes what steps a certain methodology has available.
    This is probably used in a list because GraphQL cannot describe objects with
    dynamic keys.
  `,
})
export class AvailableMethodologySteps {
  @Field(() => Methodology)
  methodology: Methodology;

  @Field(() => [Step])
  steps: Step[];
}
