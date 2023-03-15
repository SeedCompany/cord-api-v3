import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { ID, IdField, SecuredList } from '../../../common';
import { ProductMedium as Medium } from '../../product';

@ObjectType()
export class PartnershipProducingMedium {
  @Field(() => Medium)
  readonly medium: Medium;

  readonly partnership: ID | null;
}

@ObjectType()
export class SecuredPartnershipsProducingMediums extends SecuredList(
  PartnershipProducingMedium,
) {}

@InputType()
export class PartnershipProducingMediumInput {
  @Field(() => Medium)
  readonly medium: Medium;

  @IdField({
    nullable: true,
  })
  readonly partnership: ID | null;
}

@ObjectType()
export class UpdatePartnershipProducingMediumOutput {
  readonly engagement: ID;
}
