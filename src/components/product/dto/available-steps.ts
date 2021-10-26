import { ArgsType, Field } from '@nestjs/graphql';
import { ProducibleType } from './producible.dto';
import { ProductApproach as Approach } from './product-approach';
import {
  ApproachToMethodologies,
  ProductMethodology as Methodology,
} from './product-methodology';
import { ProductStep as Step } from './product-step.enum';

@ArgsType()
export class AvailableStepsOptions {
  @Field(() => ProducibleType, {
    nullable: true,
  })
  type?: ProducibleType;

  @Field(() => Methodology, {
    nullable: true,
  })
  methodology?: Methodology;
}

export const getAvailableSteps = ({
  type,
  methodology,
}: AvailableStepsOptions): readonly Step[] => {
  if (type === 'OtherProduct') {
    return [Step.Completed];
  }
  if (type === ProducibleType.EthnoArt) {
    return [Step.Develop, Step.Completed];
  }
  if (!methodology) {
    return [];
  }
  if (methodology === Methodology.Film) {
    return [Step.Translate, Step.Completed];
  }
  if (methodology === Methodology.SignLanguage) {
    return [
      Step.ExegesisAndFirstDraft,
      Step.TeamCheck,
      Step.CommunityTesting,
      Step.BackTranslation,
      Step.ConsultantCheck,
      Step.Completed,
    ];
  }
  if (ApproachToMethodologies[Approach.OralStories].includes(methodology)) {
    return [Step.Craft, Step.Test, Step.Check, Step.Completed];
  }
  if (ApproachToMethodologies[Approach.OralTranslation].includes(methodology)) {
    return [
      Step.InternalizationAndDrafting,
      Step.PeerRevision,
      Step.CommunityTesting,
      Step.BackTranslation,
      Step.ConsultantCheck,
      Step.Completed,
    ];
  }
  if (ApproachToMethodologies[Approach.Written].includes(methodology)) {
    return [
      Step.ExegesisAndFirstDraft,
      Step.TeamCheck,
      Step.CommunityTesting,
      Step.BackTranslation,
      Step.ConsultantCheck,
      Step.Completed,
    ];
  }

  return [];
};
