import { Field, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DateTimeField,
  ID,
  Resource,
  Secured,
  SecuredBoolean,
  SecuredEnumList,
  SecuredProperty,
  SecuredProps,
  SecuredString,
} from '../../../common';
import { FinancialReportingType } from '../../partnership/dto/financial-reporting-type';
import { IProject } from '../../project/dto';
import { SecuredPartnerTypes } from './partner-type.enum';

@ObjectType({
  description: SecuredEnumList.descriptionFor('financial reporting types'),
})
export abstract class SecuredFinancialReportingTypes extends SecuredEnumList(
  FinancialReportingType
) {}

@ObjectType({
  implements: Resource,
})
export class Partner extends Resource {
  static readonly Props = keysOf<Partner>();
  static readonly SecuredProps = keysOf<SecuredProps<Partner>>();
  static readonly Relations = {
    projects: [IProject],
  };

  readonly organization: Secured<ID>;

  readonly pointOfContact: Secured<ID>;

  @Field()
  readonly types: SecuredPartnerTypes;

  @Field()
  readonly financialReportingTypes: SecuredFinancialReportingTypes;

  @Field()
  readonly pmcEntityCode: SecuredString;

  @Field()
  readonly globalInnovationsClient: SecuredBoolean;

  @Field()
  readonly active: SecuredBoolean;

  @Field()
  readonly address: SecuredString;

  @DateTimeField()
  readonly modifiedAt: DateTime;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a partner'),
})
export class SecuredPartner extends SecuredProperty(Partner) {}
