import { Field, ObjectType } from '@nestjs/graphql';
import {
  Resource,
  Secured,
  SecuredBoolean,
  SecuredProperty,
  SecuredString,
} from '../../../common';
import { SecuredFinancialReportingType } from '../../partnership/dto/partnership.dto';
import { SecuredPartnerTypes } from './partner-type.enum';

@ObjectType({
  implements: Resource,
})
export class Partner extends Resource {
  readonly organization: Secured<string>;

  readonly pointOfContact: Secured<string>;

  @Field()
  readonly types: SecuredPartnerTypes;

  @Field()
  readonly financialReportingType: SecuredFinancialReportingType;

  @Field()
  readonly pmcEntityCode: SecuredString;

  @Field()
  readonly globalInnovationsClient: SecuredBoolean;

  @Field()
  readonly active: SecuredBoolean;

  @Field()
  readonly address: SecuredString;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a partner'),
})
export class SecuredPartner extends SecuredProperty(Partner) {}
