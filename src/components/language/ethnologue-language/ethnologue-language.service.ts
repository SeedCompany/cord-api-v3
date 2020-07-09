import {
  Injectable,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession } from '../../../common';
import {
  ConfigService,
  DatabaseService,
  ILogger,
  Logger,
  matchSession,
} from '../../../core';
import {
  CreateEthnologueLanguage,
  EthnologueLanguage,
  UpdateEthnologueLanguage,
} from '../dto';

@Injectable()
export class EthnologueLanguageService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Logger('language:ethnologue:service') private readonly logger: ILogger
  ) {}

  // helper method for defining properties
  property = (prop: string, value: any) => {
    const createdAt = DateTime.local();
    const propLabel = 'Property';
    return [
      [
        node('newEthnologueLanguage'),
        relation('out', '', prop, {
          active: true,
          createdAt,
        }),
        node(prop, propLabel, {
          active: true,
          value,
        }),
      ],
    ];
  };

  // helper method for defining properties
  permission = (property: string) => {
    const createdAt = DateTime.local();
    return [
      [
        node('adminSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: true,
          admin: true,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node('newEthnologueLanguage'),
      ],
      [
        node('readerSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: false,
          admin: false,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node('newEthnologueLanguage'),
      ],
    ];
  };

  propMatch = (property: string) => {
    const perm = 'canRead' + upperFirst(property);
    return [
      [
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('securityGroup', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node(perm, 'Permission', {
          property,
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('lang'),
        relation('out', '', property, { active: true }),
        node(property, 'Property', { active: true }),
      ],
    ];
  };

  async readOne(
    id: string,
    session: ISession
  ): Promise<{ ethnologue: EthnologueLanguage; ethnologueId: string }> {
    this.logger.info(`Read ethnologueLanguage`, {
      id: id,
      userId: session.userId,
    });

    const readEthnologueLanguage = this.db
      .query()
      .match(
        matchSession(session, { withAclRead: 'canReadEthnologueLanguages' })
      )
      .match([
        node('ethnologueLanguage', 'EthnologueLanguage', {
          active: true,
          id: id,
        }),
      ])
      .optionalMatch([...this.propMatch('id')])
      .optionalMatch([...this.propMatch('code')])
      .optionalMatch([...this.propMatch('provisionalCode')])
      .optionalMatch([...this.propMatch('name')])
      .optionalMatch([...this.propMatch('population')])
      .return({
        ethnologueLanguage: [{ id: 'ethnologueId' }],
        id: [{ value: 'id' }],
        canReadId: [
          {
            read: 'canReadIdRead',
            edit: 'canReadIdEdit',
          },
        ],
        code: [{ value: 'code' }],
        canReadCode: [
          {
            read: 'canReadCodeRead',
            edit: 'canReadCodeEdit',
          },
        ],
        provisionalCode: [{ value: 'provisionalCode' }],
        canReadProvisionalCode: [
          {
            read: 'canReadProvisionalCodeRead',
            edit: 'canReadProvisionalCodeEdit',
          },
        ],
        name: [{ value: 'name' }],
        canReadName: [
          {
            read: 'canReadNameRead',
            edit: 'canReadNameEdit',
          },
        ],
        population: [{ value: 'population' }],
        canReadPopulation: [
          {
            read: 'canReadPopulationRead',
            edit: 'canReadPopulationEdit',
          },
        ],
      });

    const result = await readEthnologueLanguage.first();

    // if (!result || !result.id) {
    //   this.logger.warning(`Could not find ethnologueLanguage`, { id: id });
    //   throw new NotFoundException('Could not find ethnologueLanguage');
    // }

    const ethnologueLanguage: EthnologueLanguage = {
      id: {
        value: result?.id,
        canRead: !!result?.canReadIdRead,
        canEdit: !!result?.canReadIdEdit,
      },
      code: {
        value: result?.code,
        canRead: !!result?.canReadCodeRead,
        canEdit: !!result?.canReadCodeEdit,
      },
      provisionalCode: {
        value: result?.provisionalCode,
        canRead: !!result?.canReadProvisionalCodeRead,
        canEdit: !!result?.canReadProvisionalCodeEdit,
      },
      name: {
        value: result?.name,
        canRead: !!result?.canReadNameRead,
        canEdit: !!result?.canReadNameEdit,
      },
      population: {
        value: result?.population,
        canRead: !!result?.canReadPopulationRead,
        canEdit: !!result?.canReadPopulationEdit,
      },
    };

    return {
      ethnologue: ethnologueLanguage,
      ethnologueId: result?.ethnologueId,
    };
  }

  async create(
    input: CreateEthnologueLanguage | undefined,
    session: ISession
  ): Promise<{ ethnologue: EthnologueLanguage; ethnologueId: string }> {
    if (!input) {
      input = Object.assign({}) as CreateEthnologueLanguage;
    }

    const id = generate();
    const createdAt = DateTime.local();

    try {
      const createEthnologueLanguage = this.db
        .query()
        .match(
          matchSession(session, { withAclEdit: 'canCreateEthnologueLanguage' })
        )
        .match([
          node('rootuser', 'User', {
            active: true,
            id: this.config.rootAdmin.id,
          }),
        ])
        .create([
          [
            node('newEthnologueLanguage', 'EthnologueLanguage', {
              active: true,
              createdAt,
              id,
              owningOrgId: session.owningOrgId,
            }),
          ],
          ...this.property('id', input.id),
          ...this.property('code', input.code),
          ...this.property('provisionalCode', input.provisionalCode),
          ...this.property('name', input.name),
          ...this.property('population', input.population),
          [
            node('adminSG', 'SecurityGroup', {
              id: generate(),
              active: true,
              createdAt,
              name: id + ' admin',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('readerSG', 'SecurityGroup', {
              id: generate(),
              active: true,
              createdAt,
              name: id + ' users',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('adminSG'),
            relation('out', '', 'member', { active: true, createdAt }),
            node('rootuser'),
          ],
          [
            node('readerSG'),
            relation('out', '', 'member', { active: true, createdAt }),
            node('rootuser'),
          ],
          ...this.permission('id'),
          ...this.permission('code'),
          ...this.permission('provisionalCode'),
          ...this.permission('name'),
          ...this.permission('population'),
        ])
        .return('newEthnologueLanguage.id as id');

      await createEthnologueLanguage.first();
    } catch (e) {
      this.logger.warning('Failed to create ethnologuelanguage', {
        exception: e,
      });

      throw new ServerException('Failed to create ethnologuelanguage');
    }

    const result = await this.readOne(id, session);
    return result;
  }

  async update(id: string, input: UpdateEthnologueLanguage, session: ISession) {
    if (!input) return;

    this.logger.info(`Update ethnologue language`, {
      id,
      input,
      userId: session.userId,
    });

    try {
      const query = this.db
        .query()
        .match(matchSession(session, { withAclRead: 'canReadLanguages' }))
        .match([
          node('ethnologueLanguage', 'EthnologueLanguage', {
            active: true,
            id: id,
          }),
        ])
        .match([
          [
            node('ethnologueLanguage'),
            relation('out', '', 'id', { active: true }),
            node('id', 'Property', { active: true }),
          ],
          [
            node('ethnologueLanguage'),
            relation('out', '', 'code', { active: true }),
            node('code', 'Property', { active: true }),
          ],
          [
            node('ethnologueLanguage'),
            relation('out', '', 'provisionalCode', { active: true }),
            node('provisionalCode', 'Property', { active: true }),
          ],
          [
            node('ethnologueLanguage'),
            relation('out', '', 'name', { active: true }),
            node('name', 'Property', { active: true }),
          ],
          [
            node('ethnologueLanguage'),
            relation('out', '', 'population', { active: true }),
            node('population', 'Property', { active: true }),
          ],
        ])
        .setValues({
          'id.value': input.id,
          'code.value': input.code,
          'provisionalCode.value': input.provisionalCode,
          'name.value': input.name,
          'population.value': input.population,
        });
      await query.run();
    } catch (e) {
      this.logger.error('update failed', { exception: e });
      throw new ServerException('Failed to update ethnologue language');
    }
  }
}
