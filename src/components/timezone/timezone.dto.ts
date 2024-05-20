import { Field, Float, ObjectType } from '@nestjs/graphql';
import { SecuredProperty } from '~/common';

@ObjectType({
  description: 'An IANA Time Zone',
})
export abstract class TimeZone {
  @Field()
  name: string;
  @Field(() => Float)
  lat: number;
  @Field(() => Float)
  long: number;
  @Field(() => [IanaCountry])
  countries: IanaCountry[];
}

@ObjectType({
  description: 'An IANA Country associated with timezones',
})
export abstract class IanaCountry {
  @Field()
  code: string;
  @Field()
  name: string;
  @Field(() => [TimeZone])
  zones: TimeZone[];
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a timezone'),
})
export class SecuredTimeZone extends SecuredProperty(TimeZone) {}
