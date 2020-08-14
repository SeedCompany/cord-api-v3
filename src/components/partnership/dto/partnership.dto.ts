import { Field, ObjectType } from '@nestjs/graphql';
import {
  Resource,
  SecuredDate,
  SecuredEnumList,
  SecuredProperty,
} from '../../../common';
import { DefinedFile } from '../../file/dto';
import { Organization } from '../../organization';
import { PartnershipAgreementStatus } from './partnership-agreement-status.enum';
import { PartnershipType } from './partnership-type.enum';

@ObjectType({
  description: SecuredProperty.descriptionFor('a partnership agreement status'),
})
export abstract class SecuredPartnershipAgreementStatus extends SecuredProperty(
  PartnershipAgreementStatus
) {}

@ObjectType({
  description: SecuredEnumList.descriptionFor('partnership types'),
})
export abstract class SecuredPartnershipTypes extends SecuredEnumList(
  PartnershipType
) {}

@ObjectType({
  implements: [Resource],
})
export class Partnership extends Resource {
  @Field()
  readonly agreementStatus: SecuredPartnershipAgreementStatus;

  readonly mou: DefinedFile;

  @Field()
  readonly mouStatus: SecuredPartnershipAgreementStatus;

  @Field()
  readonly mouStart: SecuredDate;

  @Field()
  readonly mouEnd: SecuredDate;

  @Field()
  readonly mouStartOverride: SecuredDate;

  @Field()
  readonly mouEndOverride: SecuredDate;

  readonly agreement: DefinedFile;

  @Field(() => Organization)
  readonly organization: Organization;

  @Field()
  readonly types: SecuredPartnershipTypes;
}
