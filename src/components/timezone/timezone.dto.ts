import { Field, Float, ObjectType } from '@nestjs/graphql';

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
