import { Field, ObjectType } from '@nestjs/graphql';
import { DateTime } from 'luxon';
import { DateField, DateTimeField } from './luxon.graphql';
import { Secured } from './secured-property';
import { ISecured } from './secured.interface';
import { CalendarDate } from './temporal';

@ObjectType({ implements: [ISecured] })
export abstract class SecuredDateTime implements ISecured, Secured<DateTime> {
  @DateTimeField({ nullable: true })
  readonly value?: DateTime;

  @Field()
  readonly canRead: boolean;

  @Field()
  readonly canEdit: boolean;
}

@ObjectType({ implements: [ISecured] })
export abstract class SecuredDateTimeNullable
  implements ISecured, Secured<DateTime | null>
{
  @DateTimeField({ nullable: true })
  readonly value?: DateTime | null;

  @Field()
  readonly canRead: boolean;

  @Field()
  readonly canEdit: boolean;
}

@ObjectType({ implements: [ISecured] })
export abstract class SecuredDate implements ISecured, Secured<CalendarDate> {
  @DateField({ nullable: true })
  readonly value?: CalendarDate;

  @Field()
  readonly canRead: boolean;

  @Field()
  readonly canEdit: boolean;
}

@ObjectType({ implements: [ISecured] })
export abstract class SecuredDateNullable
  implements ISecured, Secured<CalendarDate | null>
{
  @DateField({ nullable: true })
  readonly value?: CalendarDate | null;

  @Field()
  readonly canRead: boolean;

  @Field()
  readonly canEdit: boolean;
}
