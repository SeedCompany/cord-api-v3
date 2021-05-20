import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { Dictionary } from 'lodash';
import { DateTime } from 'luxon';
import { generateId, ID, Session } from '../../common';
import {
  createBaseNode,
  DatabaseService,
  matchRequestingUser,
} from '../../core';
import { DbChanges } from '../../core/database/changes';
import {
  calculateTotalAndPaginateList,
  matchProps,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { DbPropsOfDto } from '../../core/database/results';
import {
  CreateLocation,
  Location,
  LocationListInput,
  UpdateLocation,
} from './dto';

@Injectable()
export class LocationRepository {
  constructor(private readonly db: DatabaseService) {}

  async checkName(name: string) {
    return await this.db
      .query()
      .match([node('name', 'LocationName', { value: name })])
      .return('name')
      .first();
  }

  async create(session: Session, input: CreateLocation) {
    const secureProps = [
      {
        key: 'name',
        value: input.name,
        isPublic: false,
        isOrgPublic: false,
        label: 'LocationName',
      },
      {
        key: 'isoAlpha3',
        value: input.isoAlpha3,
        isPublic: false,
        isOrgPublic: false,
        label: 'IsoAlpha3',
      },
      {
        key: 'type',
        value: input.type,
        isPublic: false,
        isOrgPublic: false,
        label: 'LocationType',
      },
      {
        key: 'canDelete',
        value: true,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    // create location
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(createBaseNode(await generateId(), 'Location', secureProps))
      .return('node.id as id');

    return await query.first();
  }

  async createProperties(
    type: 'fundingAccount' | 'defaultFieldRegion',
    result: Dictionary<any> | undefined,
    input: CreateLocation,
    createdAt: DateTime
  ) {
    if (type === 'fundingAccount') {
      await this.db
        .query()
        .matchNode('location', 'Location', {
          id: result?.id,
        })
        .matchNode('fundingAccount', 'FundingAccount', {
          id: input.fundingAccountId,
        })
        .create([
          node('location'),
          relation('out', '', 'fundingAccount', {
            active: true,
            createdAt,
          }),
          node('fundingAccount'),
        ])
        .run();
    } else {
      await this.db
        .query()
        .matchNode('location', 'Location', {
          id: result?.id,
        })
        .matchNode('defaultFieldRegion', 'FieldRegion', {
          id: input.defaultFieldRegionId,
        })
        .create([
          node('location'),
          relation('out', '', 'defaultFieldRegion', {
            active: true,
            createdAt,
          }),
          node('defaultFieldRegion'),
        ])
        .run();
    }
  }
  readOne(id: ID, session: Session) {
    return this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'Location', { id: id })])
      .apply(matchProps())
      .optionalMatch([
        node('node'),
        relation('out', '', 'fundingAccount', { active: true }),
        node('fundingAccount', 'FundingAccount'),
      ])
      .optionalMatch([
        node('node'),
        relation('out', '', 'defaultFieldRegion', { active: true }),
        node('defaultFieldRegion', 'FieldRegion'),
      ])
      .return(
        'apoc.map.merge(props, { fundingAccount: fundingAccount.id, defaultFieldRegion: defaultFieldRegion.id }) as props'
      )
      .asResult<{ props: DbPropsOfDto<Location, true> }>();
    // return await query.first();
  }

  async checkDeletePermission(id: ID, session: Session) {
    return await this.db.checkDeletePermission(id, session);
  }

  getActualChanges(location: Location, input: UpdateLocation) {
    return this.db.getActualChanges(Location, location, input);
  }

  async updateProperties(object: Location, changes: DbChanges<Location>) {
    await this.db.updateProperties({
      type: Location,
      object,
      changes,
    });
  }

  async updateLocationProperties(
    type: 'fundingAccount' | 'defaultFieldRegion',
    session: Session,
    propertyId: ID,
    locationId: ID
  ) {
    if (type === 'fundingAccount') {
      const createdAt = DateTime.local();
      await this.db
        .query()
        .apply(matchRequestingUser(session))
        .matchNode('location', 'Location', { id: locationId })
        .matchNode('newFundingAccount', 'FundingAccount', {
          id: propertyId,
        })
        .optionalMatch([
          node('location'),
          relation('out', 'oldFundingAccountRel', 'fundingAccount', {
            active: true,
          }),
          node('fundingAccount', 'FundingAccount'),
        ])
        .create([
          node('location'),
          relation('out', '', 'fundingAccount', {
            active: true,
            createdAt,
          }),
          node('newFundingAccount'),
        ])
        .set({
          values: {
            'oldFundingAccountRel.active': false,
          },
        })
        .run();
    } else {
      const createdAt = DateTime.local();
      await this.db
        .query()
        .apply(matchRequestingUser(session))
        .matchNode('location', 'Location', { id: locationId })
        .matchNode('newDefaultFieldRegion', 'FieldRegion', {
          id: propertyId,
        })
        .optionalMatch([
          node('location'),
          relation('out', 'oldDefaultFieldRegionRel', 'defaultFieldRegion', {
            active: true,
          }),
          node('defaultFieldRegion', 'FieldRegion'),
        ])
        .create([
          node('location'),
          relation('out', '', 'defaultFieldRegion', {
            active: true,
            createdAt,
          }),
          node('newDefaultFieldRegion'),
        ])
        .set({
          values: {
            'oldDefaultFieldRegionRel.active': false,
          },
        })
        .run();
    }
  }

  async deleteNode(node: Location) {
    await this.db.deleteNode(node);
  }

  list({ filter, ...input }: LocationListInput, session: Session) {
    const label = 'Location';
    return this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode(label)])
      .apply(calculateTotalAndPaginateList(Location, input));
  }

  async addLocationToNode(label: string, id: ID, rel: string, locationId: ID) {
    await this.db
      .query()
      .matchNode('node', label, { id })
      .matchNode('location', 'Location', { id: locationId })
      .create([
        node('node'),
        relation('out', '', rel, {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('location'),
      ])
      .run();
  }

  async removeLocationFromNode(
    label: string,
    id: ID,
    rel: string,
    locationId: ID
  ) {
    await this.db
      .query()
      .matchNode('node', label, { id })
      .matchNode('location', 'Location', { id: locationId })
      .match([
        [
          node('node'),
          relation('out', 'rel', rel, { active: true }),
          node('location'),
        ],
      ])
      .setValues({
        'rel.active': false,
      })
      .run();
  }

  listLocationsFromNode(
    label: string,
    id: ID,
    rel: string,
    input: LocationListInput,
    session: Session
  ) {
    return this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode('Location'),
        relation('in', '', rel, { active: true }),
        node(`${label.toLowerCase()}`, label, { id }),
      ])
      .apply(calculateTotalAndPaginateList(Location, input));
  }
}
