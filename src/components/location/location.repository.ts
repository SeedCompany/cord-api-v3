import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  generateId,
  ID,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { DtoRepository } from '../../core';
import {
  ACTIVE,
  createNode,
  createRelationships,
  matchProps,
  matchRequestingUser,
  merge,
  paginate,
  sorting,
} from '../../core/database/query';
import { FileId } from '../file';
import {
  CreateLocation,
  Location,
  LocationListInput,
  UpdateLocation,
} from './dto';

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
    const mapImageId = await generateId<FileId>();

    const initialProps = {
      name: input.name,
      isoAlpha3: input.isoAlpha3,
      type: input.type,
      mapImage: mapImageId,
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
          defaultMarketingRegion: ['Location', input.defaultMarketingRegionId],
        }),
      )
      .return<{ id: ID }>('node.id as id');

    const result = await query.first();
    if (!result) {
      throw new ServerException('Failed to create location');
    }

    return { id: result.id, mapImageId };
  }

  async update(changes: UpdateLocation) {
    const {
      id,
      fundingAccountId,
      defaultFieldRegionId,
      defaultMarketingRegionId,
      mapImage,
      ...simpleChanges
    } = changes;

    await this.updateProperties({ id }, simpleChanges);

    if (fundingAccountId !== undefined) {
      await this.updateRelation(
        'fundingAccount',
        'FundingAccount',
        id,
        fundingAccountId,
      );
    }

    if (defaultFieldRegionId !== undefined) {
      await this.updateRelation(
        'defaultFieldRegion',
        'FieldRegion',
        id,
        defaultFieldRegionId,
      );
    }

    if (defaultMarketingRegionId !== undefined) {
      await this.updateRelation(
        'defaultMarketingRegion',
        'Location',
        id,
        defaultMarketingRegionId,
      );
    }
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
        .optionalMatch([
          node('node'),
          relation('out', '', 'defaultMarketingRegion', ACTIVE),
          node('defaultMarketingRegion', 'Location'),
        ])
        .return<{ dto: UnsecuredDto<Location> }>(
          merge('props', {
            mapImage: { id: 'props.mapImage' },
            fundingAccount: 'fundingAccount {.id}',
            defaultFieldRegion: 'defaultFieldRegion {.id}',
            defaultMarketingRegion: 'defaultMarketingRegion {.id}',
          }).as('dto'),
        );
  }

  async list({ filter, ...input }: LocationListInput, _session: Session) {
    const result = await this.db
      .query()
      .matchNode('node', 'Location')
      .apply(sorting(Location, input))
      .apply(paginate(input, this.hydrate()))
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
    locationId: ID,
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

  async listLocationsFromNodeNoSecGroups(
    label: string,
    rel: string,
    id: ID,
    input: LocationListInput,
  ) {
    const result = await this.db
      .query()
      .match([
        node('node', 'Location'),
        relation('in', '', rel, ACTIVE),
        node(`${label.toLowerCase()}`, label, { id }),
      ])
      .apply(sorting(Location, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
