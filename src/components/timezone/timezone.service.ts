import { Resolver } from '@nestjs/graphql';
import got from 'got';
import { mapValues } from 'lodash';
import { IanaCountry, TimeZone } from './timezone.dto';

interface TzJson {
  countries: Record<string, TzCountryJson>;
  zones: Record<string, ZoneJson>;
}

interface TzCountryJson {
  name: string;
  abbr: string;
  zones: string[];
}

interface ZoneJson {
  name: string;
  lat: number;
  long: number;
  countries: string[];
  comments: string;
}

@Resolver()
export class TimeZoneService {
  private readonly httpCache = new Map();

  async timezones(): Promise<Record<string, TimeZone>> {
    const d = await this.getData();
    return d.zones;
  }

  async countries(): Promise<Record<string, IanaCountry>> {
    const d = await this.getData();
    return d.countries;
  }

  private async getData() {
    const data = await got
      .get(
        'https://raw.githubusercontent.com/moment/moment-timezone/master/data/meta/latest.json',
        {
          cache: this.httpCache,
        },
      )
      .json<TzJson>();

    // Convert lists of codes to lists of their objects
    // This creates circular references but GQL should handle it
    const countries = mapValues(data.countries, (c) => {
      const o = c as unknown as IanaCountry;
      o.code = c.abbr;
      // @ts-expect-error we are converting c to o here. Using the same object is
      // necessary so that we can maintain the cyclic references between countries & zones.
      delete c.abbr;
      o.zones = c.zones.map((zone) => data.zones[zone]) as any;
      return o;
    });
    const zones = mapValues(data.zones, (z) => {
      z.countries = z.countries.map((c) => data.countries[c]) as any;
      return z as unknown as TimeZone;
    });

    return { zones, countries };
  }
}
