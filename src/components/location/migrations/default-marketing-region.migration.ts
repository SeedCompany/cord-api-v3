import { node, relation } from 'cypher-query-builder';
import { ID, IdOf } from '~/common';
import { BaseMigration, Migration } from '~/core/database';
import { ACTIVE } from '~/core/database/query';
import { Location } from '../dto';
import { UpdateLocation } from '../dto/update-location.dto';
import { LocationService } from '../location.service';

@Migration('2024-02-06T06:22:15')
export class DefaultMarketingRegionMigration extends BaseMigration {
  constructor(private readonly locationService: LocationService) {
    super();
  }
  async up() {
    const session = this.fakeAdminSession;
    const mRegions = await this.db
      .query()
      .match([
        node('location', 'Location'),
        relation('out', '', 'type', ACTIVE),
        node('locType', 'LocationType'),
      ])
      .match([
        node('location', 'Location'),
        relation('out', '', 'name', ACTIVE),
        node('locName', 'LocationName'),
      ])
      .raw('WHERE locType.value = "Region"')
      .return<{ id: IdOf<Location>; locationName: string }>([
        'location.id as id',
        'locName.value as locationName',
      ])
      .run();

    const countries = await this.db
      .query()
      .match([
        node('location', 'Location'),
        relation('out', '', 'type', ACTIVE),
        node('locType', 'LocationType'),
      ])
      .match([
        node('location', 'Location'),
        relation('out', '', 'defaultFieldRegion', ACTIVE),
        node('fieldRegion', 'FieldRegion'),
      ])
      .match([
        node('fieldRegion', 'FieldRegion'),
        relation('out', '', 'name', ACTIVE),
        node('fieldRegionName', 'FieldRegionName'),
      ])
      .raw('WHERE locType.value = "Country"')
      .return<{ id: ID; fieldRegionName: string; fieldRegionId: ID }>([
        'location.id as id',
        'fieldRegionName.value as fieldRegionName',
        'fieldRegion.id as fieldRegionId',
      ])
      .run();

    const fieldOperAreaMap: { [key: string]: string } = {
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
      any: 'Not Specified',
    };

    const marketingRegionIdMap: { [key: string]: IdOf<Location> } = {};

    mRegions.forEach((m) => {
      marketingRegionIdMap[m.locationName] = m.id;
    });

    for (const c of countries) {
      const marketingRegionName = fieldOperAreaMap[c.fieldRegionName];

      const marketingRegionId = marketingRegionIdMap[marketingRegionName];

      if (marketingRegionId === undefined) {
        continue;
      }
      const locationToBeUpdated = await this.locationService.readOne(
        c.id,
        session,
      );
      const countryToUpdate: UpdateLocation = {
        id: locationToBeUpdated.id,
        defaultMarketingRegionId: marketingRegionId,
      };

      await this.locationService.update(countryToUpdate, session);
    }
  }
}
