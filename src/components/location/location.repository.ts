import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { DtoRepository, matchRequestingUser } from '../../core';
import {
  ACTIVE,
  createNode,
  createRelationships,
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
    const initialProps = {
      name: input.name,
      isoAlpha3: input.isoAlpha3,
      type: input.type,
      canDelete: true,
    };

    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(await createNode(Location, { initialProps }))
      .apply(
        createRelationships(Location, 'out', {
          fundingAccount: ['FundingAccount', input.fundingAccountId],
          defaultFieldRegion: ['FieldRegion', input.defaultFieldRegionId],
        })
      )
      .return<{ id: ID }>('node.id as id');

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

  protected hydrate() {
    return (query: Query) =>
      query
        .apply(matchProps())
        .optionalMatch([
          node('node'),
          relation('out', '', 'fundingAccount', ACTIVE),
          node('fundingAccount', 'FundingAccount'),
        ])
        .optionalMatch([
          node('node'),
          relation('out', '', 'defaultFieldRegion', ACTIVE),
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
        node('node'),
        relation('out', 'rel', rel, ACTIVE),
        node('location'),
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
        relation('in', '', rel, ACTIVE),
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
        relation('in', '', rel, ACTIVE),
        node(`${label.toLowerCase()}`, label, { id }),
      ])
      .apply(sorting(Location, input))
      .apply(paginate(input))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
