import { Resolver } from '@nestjs/graphql';
import { mapValues } from '@seedcompany/common';
import { mkdir, readFile, writeFile } from 'fs/promises';
import got from 'got';
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

interface ParsedTimeZones {
  zones: Record<string, TimeZone>;
  countries: Record<string, IanaCountry>;
}

@Resolver()
export class TimeZoneService {
  async timezones() {
    const d = await this.getData();
    return d.zones;
  }

  async countries() {
    const d = await this.getData();
    return d.countries;
  }

  private async getData() {
    if (!this.#fetchingData) {
      this.#fetchingData = this.loadAndParse();
    }
    try {
      return await this.#fetchingData;
    } catch (e) {
      this.#fetchingData = undefined;
      return { zones: {}, countries: {} };
    }
  }
  #fetchingData: Promise<ParsedTimeZones> | undefined;

  private async loadAndParse(): Promise<ParsedTimeZones> {
    const data = JSON.parse(await this.loadFromFsOrDownload()) as TzJson;

    // Convert lists of codes to lists of their objects
    // This creates circular references, but GQL should handle it
    const countries = mapValues(data.countries, (_, c) => {
      const o = c as unknown as IanaCountry;
      o.code = c.abbr;
      // @ts-expect-error we are converting c to o here. Using the same object is
      // necessary so that we can maintain the cyclic references between countries & zones.
      delete c.abbr;
      o.zones = c.zones.map((zone) => data.zones[zone]) as any;
      return o;
    }).asRecord;
    const zones = mapValues(data.zones, (_, z) => {
      z.countries = z.countries.map((c) => data.countries[c]) as any;
      return z as unknown as TimeZone;
    }).asRecord;

    return { zones, countries };
  }

  private async loadFromFsOrDownload() {
    try {
      return await readFile('.cache/timezones', 'utf-8');
    } catch (e) {
      const sourceUrl =
        'https://raw.githubusercontent.com/moment/moment-timezone/master/data/meta/latest.json';
      const text = await got.get(sourceUrl).text();
      await mkdir('.cache', { recursive: true });
      await writeFile('.cache/timezones', text, 'utf-8');
      return text;
    }
  }
}
