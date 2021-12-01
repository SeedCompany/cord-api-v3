import { Type } from '@nestjs/common';
import { Field, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DateTimeField,
  ID,
  IntersectionType,
  Resource,
  Secured,
  SecuredBoolean,
  SecuredEnumList,
  SecuredProperty,
  SecuredProps,
  SecuredString,
  Sensitivity,
  SensitivityField,
} from '../../../common';
import { ScopedRole } from '../../authorization';
import { FinancialReportingType } from '../../partnership/dto/financial-reporting-type';
import { Pinnable } from '../../pin/dto';
import { IProject } from '../../project/dto';
import { SecuredPartnerTypes } from './partner-type.enum';

const PinnableResource: Type<Resource & Pinnable> = IntersectionType(
  Resource,
  Pinnable
);

@ObjectType({
  description: SecuredEnumList.descriptionFor('financial reporting types'),
})
export abstract class SecuredFinancialReportingTypes extends SecuredEnumList(
  FinancialReportingType
) {}

@ObjectType({
  implements: [Resource, Pinnable],
})
export class Partner extends PinnableResource {
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

  @SensitivityField({
    description: "Based on the project's sensitivity",
  })
  readonly sensitivity: Sensitivity;

  // A list of non-global roles the requesting user has available for this object.
  // This is just a cache, to prevent extra db lookups within the same request.
  readonly scope: ScopedRole[];
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a partner'),
})
export class SecuredPartner extends SecuredProperty(Partner) {}
