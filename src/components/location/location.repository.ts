import { Injectable } from '@nestjs/common';
import { node, type Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  CreationFailed,
  DuplicateException,
  generateId,
  type ID,
  NotFoundException,
  ReadAfterCreationFailed,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { DtoRepository, OnIndex } from '~/core/database';
import {
  ACTIVE,
  createNode,
  createRelationships,
  defineSorters,
  filter,
  FullTextIndex,
  matchProps,
  merge,
  paginate,
  sortWith,
} from '~/core/database/query';
import { FileService } from '../file';
import { type FileId } from '../file/dto';
import {
  type CreateLocation,
  Location,
  LocationFilters,
  type LocationListInput,
  type UpdateLocation,
} from './dto';

@Injectable()
export class LocationRepository extends DtoRepository(Location) {
  constructor(private readonly files: FileService) {
    super();
  }
  async create(input: CreateLocation) {
    const checkName = await this.doesNameExist(input.name);
    if (checkName) {
      throw new DuplicateException(
        'location.name',
        'Location with this name already exists.',
      );
    }

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
      .apply(await createNode(Location, { initialProps }))
      .apply(
        createRelationships(Location, 'out', {
          fundingAccount: ['FundingAccount', input.fundingAccount],
          defaultFieldRegion: ['FieldRegion', input.defaultFieldRegion],
          defaultMarketingRegion: ['Location', input.defaultMarketingRegion],
        }),
      )
      .return<{ id: ID }>('node.id as id');

    const result = await query.first();
    if (!result) {
      throw new CreationFailed(Location);
    }

    const dto = await this.readOne(result.id).catch((e) => {
      throw e instanceof NotFoundException
        ? new ReadAfterCreationFailed(Location)
        : e;
    });

    await this.files.createDefinedFile(
      mapImageId,
      input.name,
      dto.id,
      'mapImage',
      input.mapImage,
      'location.mapImage',
      true,
    );

    return dto;
  }

  async update(changes: UpdateLocation) {
    const {
      id,
      fundingAccount,
      defaultFieldRegion,
      defaultMarketingRegion,
      mapImage,
      ...simpleChanges
    } = changes;

    await this.updateProperties({ id }, simpleChanges);

    if (fundingAccount !== undefined) {
      await this.updateRelation(
        'fundingAccount',
        'FundingAccount',
        id,
        fundingAccount,
      );
    }

    if (mapImage !== undefined) {
      const location = await this.readOne(id);

      if (!location.mapImage) {
        throw new ServerException(
          'Expected map image file to be updated with the location',
        );
      }

      await this.files.createFileVersion({
        ...mapImage,
        parent: location.mapImage.id,
      });
    }

    if (defaultFieldRegion !== undefined) {
      await this.updateRelation(
        'defaultFieldRegion',
        'FieldRegion',
        id,
        defaultFieldRegion,
      );
    }

    if (defaultMarketingRegion !== undefined) {
      await this.updateRelation(
        'defaultMarketingRegion',
        'Location',
        id,
        defaultMarketingRegion,
      );
    }

    return await this.readOne(id);
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

  async list(input: LocationListInput) {
    const result = await this.db
      .query()
      .matchNode('node', 'Location')
      .apply(locationFilters(input.filter))
      .apply(sortWith(locationSorters, input))
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
      .apply(sortWith(locationSorters, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  private async doesNameExist(name: string) {
    const result = await this.db
      .query()
      .match([node('name', 'LocationName', { value: name })])
      .return('name')
      .first();
    return !!result;
  }

  @OnIndex('schema')
  private async createSchemaIndexes() {
    await this.db.query().apply(NameIndex.create()).run();
  }
}

export const locationSorters = defineSorters(Location, {});

export const locationFilters = filter.define(() => LocationFilters, {
  fundingAccountId: filter.pathExists((id) => [
    node('node'),
    relation('out', '', 'fundingAccount', ACTIVE),
    node('', 'FundingAccount', { id }),
  ]),
  type: filter.stringListProp(),
  name: filter.fullText({
    index: () => NameIndex,
    matchToNode: (q) =>
      q.match([
        node('node', 'Location'),
        relation('out', '', undefined, ACTIVE),
        node('match'),
      ]),
  }),
});

const NameIndex = FullTextIndex({
  indexName: 'LocationName',
  labels: 'LocationName',
  properties: 'value',
  analyzer: 'standard-folding',
});
