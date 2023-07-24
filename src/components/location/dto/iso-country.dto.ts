import { Field, ObjectType } from '@nestjs/graphql';
import type { Country } from 'iso-3166-1/dist/iso-3166.js';

@ObjectType({
  description: 'An entry of the ISO 3166-1 standard list for countries',
})
export abstract class IsoCountry implements Country {
  @Field({
    description: 'The name of the country in plain English',
  })
  country: string;

  @Field({
    description: 'The 2 letter code',
  })
  alpha2: string;

  @Field({
    description: 'The 3 letter code',
  })
  alpha3: string;

  @Field({
    description: 'The numeric code',
  })
  numeric: string;
}
