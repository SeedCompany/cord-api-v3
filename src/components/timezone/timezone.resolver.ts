import { Args, Query, Resolver } from '@nestjs/graphql';
import { IanaCountry, TimeZone } from './timezone.dto';
import { TimeZoneService } from './timezone.service';

@Resolver()
export class TimeZoneResolver {
  constructor(private readonly service: TimeZoneService) {}

  @Query(() => [TimeZone])
  async timezones(): Promise<TimeZone[]> {
    const zones = await this.service.timezones();
    return Object.values(zones);
  }

  @Query(() => TimeZone, { nullable: true })
  async timezone(@Args('name') name: string): Promise<TimeZone | undefined> {
    const zones = await this.service.timezones();
    return zones[name];
  }

  @Query(() => [IanaCountry])
  async ianaCountries(): Promise<IanaCountry[]> {
    const countries = await this.service.countries();
    return Object.values(countries);
  }

  @Query(() => IanaCountry, { nullable: true })
  async ianaCountry(
    @Args('code') code: string,
  ): Promise<IanaCountry | undefined> {
    const countries = await this.service.countries();
    return countries[code];
  }
}
