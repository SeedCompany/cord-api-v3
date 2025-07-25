import { mapEntries } from '@seedcompany/common';
import { node, relation } from 'cypher-query-builder';
import { type ValueOf } from 'type-fest';
import { type ID, type IdOf } from '~/common';
import { BaseMigration, Migration } from '~/core/database';
import { ACTIVE } from '~/core/database/query';
import { type Location } from '../dto';
import { LocationService } from '../location.service';

@Migration('2024-01-16T11:00:00')
export class DefaultMarketingRegionMigration extends BaseMigration {
  constructor(private readonly locationService: LocationService) {
    super();
  }
  async up() {
    const fieldRegionNameToMarketingRegionName = {
      'Africa - Anglophone East': 'Africa',
      'Africa - Anglophone West': 'Africa',
      'Africa - Congo Basin': 'Africa',
      'Africa - Sahel': 'Africa',
      'Africa - Southern': 'Africa',
      Americas: 'Americas',
      Eurasia: 'Europe and the Middle East',
      Pacific: 'Pacific',
      'Asia - Islands': 'Pacific',
      'Asia - Mainland': 'Asia',
      'Asia - South': 'Asia',
    } as const;

    const marketingRegionList = await this.db
      .query()
      .match([
        node('location', 'Location'),
        relation('out', '', 'type', ACTIVE),
        node('', 'LocationType', { value: 'Region' }),
      ])
      .match([
        node('location'),
        relation('out', '', 'name', ACTIVE),
        node('locName', 'LocationName'),
      ])
      .return<{
        id: IdOf<Location>;
        name: ValueOf<typeof fieldRegionNameToMarketingRegionName>;
      }>(['location.id as id', 'locName.value as name'])
      .run();
    const marketingRegionNameToId = mapEntries(marketingRegionList, (loc) => [
      loc.name,
      loc.id,
    ]).asMap;

    const countries = await this.db
      .query()
      .match([
        node('location', 'Location'),
        relation('out', '', 'type', ACTIVE),
        node('', 'LocationType', { value: 'Country' }),
      ])
      .match([
        node('location', 'Location'),
        relation('out', '', 'defaultFieldRegion', ACTIVE),
        node('fieldRegion', 'FieldRegion'),
        relation('out', '', 'name', ACTIVE),
        node('fieldRegionName', 'FieldRegionName'),
      ])
      .return<{
        id: ID;
        fieldRegionName: keyof typeof fieldRegionNameToMarketingRegionName;
      }>(['location.id as id', 'fieldRegionName.value as fieldRegionName'])
      .run();

    for (const country of countries) {
      const marketingRegionName =
        fieldRegionNameToMarketingRegionName[country.fieldRegionName];
      const marketingRegionId =
        marketingRegionNameToId.get(marketingRegionName);
      if (marketingRegionId === undefined) {
        continue;
      }

      await this.locationService.update({
        id: country.id,
        defaultMarketingRegionId: marketingRegionId,
      });
    }
  }
}
