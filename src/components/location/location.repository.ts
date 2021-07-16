import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  generateId,
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { createBaseNode, DtoRepository, matchRequestingUser } from '../../core';
import {
  matchProps,
  merge,
  paginate,
  permissionsOfNode,
  requestingUser,
  sorting,
} from '../../core/database/query';
import { CreateLocation, Location, LocationListInput } from './dto';

@Injectable()
export class LocationRepository extends DtoRepository(Location) {
  async doesNameExist(name: string) {
    const result = await this.db
      .query()
      .match([node('name', 'LocationName', { value: name })])
      .return('name')
      .first();
    return !!result;
  }

  async create(input: CreateLocation, session: Session) {
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

    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(createBaseNode(await generateId(), 'Location', secureProps))
      .apply((q) => {
        if (input.fundingAccountId) {
          q.with('node')
            .matchNode('fundingAccount', 'FundingAccount', {
              id: input.fundingAccountId,
            })
            .create([
              node('node'),
              relation('out', '', 'fundingAccount', {
                active: true,
                createdAt: DateTime.local(),
              }),
              node('fundingAccount'),
            ]);
        }
        if (input.defaultFieldRegionId) {
          q.with('node')
            .matchNode('defaultFieldRegion', 'FieldRegion', {
              id: input.defaultFieldRegionId,
            })
            .create([
              node('node'),
              relation('out', '', 'defaultFieldRegion', {
                active: true,
                createdAt: DateTime.local(),
              }),
              node('defaultFieldRegion'),
            ]);
        }
      })
      .return('node.id as id')
      .asResult<{ id: ID }>();

    const result = await query.first();
    if (!result) {
      throw new ServerException('Failed to create location');
    }

    return result.id;
  }

  async readOne(id: ID, session: Session) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'Location', { id: id })])
      .apply(this.hydrate());

    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find location');
    }
    return result.dto;
  }

  private hydrate() {
    return (query: Query) =>
      query
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
        .return<{ dto: UnsecuredDto<Location> }>(
          merge('props', {
            fundingAccount: 'fundingAccount.id',
            defaultFieldRegion: 'defaultFieldRegion.id',
          }).as('dto')
        );
  }

  async updateFundingAccount(id: ID, fundingAccount: ID, session: Session) {
    await this.db
      .query()
      .apply(matchRequestingUser(session))
      .matchNode('location', 'Location', { id })
      .matchNode('newFundingAccount', 'FundingAccount', {
        id: fundingAccount,
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
          createdAt: DateTime.local(),
        }),
        node('newFundingAccount'),
      ])
      .set({
        values: {
          'oldFundingAccountRel.active': false,
        },
      })
      .run();
  }

  async updateDefaultFieldRegion(id: ID, fieldRegion: ID, session: Session) {
    await this.db
      .query()
      .apply(matchRequestingUser(session))
      .matchNode('location', 'Location', { id })
      .matchNode('newDefaultFieldRegion', 'FieldRegion', {
        id: fieldRegion,
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
          createdAt: DateTime.local(),
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

  async list({ filter, ...input }: LocationListInput, session: Session) {
    const result = await this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode('Location')])
      .apply(sorting(Location, input))
      .apply(paginate(input))
      .first();
    return result!; // result from paginate() will always have 1 row.
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

  async listLocationsFromNode(
    label: string,
    id: ID,
    rel: string,
    input: LocationListInput,
    session: Session
  ) {
    const result = await this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode('Location'),
        relation('in', '', rel, { active: true }),
        node(`${label.toLowerCase()}`, label, { id }),
      ])
      .apply(sorting(Location, input))
      .apply(paginate(input))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  async listLocationsFromNodeNoSecGroups(
    label: string,
    rel: string,
    id: ID,
    input: LocationListInput
  ) {
    const result = await this.db
      .query()
      .match([
        node('node', 'Location'),
        relation('in', '', rel, { active: true }),
        node(`${label.toLowerCase()}`, label, { id }),
      ])
      .apply(sorting(Location, input))
      .apply(paginate(input))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
