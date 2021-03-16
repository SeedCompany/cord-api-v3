import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import {
  DuplicateException,
  generateId,
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import {
  ConfigService,
  createBaseNode,
  DatabaseService,
  ILogger,
  Logger,
  matchRequestingUser,
  OnIndex,
  Property,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  defaultSorter,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  runListQuery,
  StandardReadResult,
} from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { ScriptureReferenceService } from '../scripture/scripture-reference.service';
import {
  CreateLiteracyMaterial,
  LiteracyMaterial,
  LiteracyMaterialListInput,
  LiteracyMaterialListOutput,
  UpdateLiteracyMaterial,
} from './dto';
import { DbLiteracyMaterial } from './model';

@Injectable()
export class LiteracyMaterialService {
  private readonly securedProperties = {
    name: true,
    scriptureReferences: true,
  };

  constructor(
    @Logger('literacyMaterial:service') private readonly logger: ILogger,
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly scriptureRefService: ScriptureReferenceService,
    private readonly authorizationService: AuthorizationService
  ) {}

  @OnIndex()
  async createIndexes() {
    return [
      'CREATE CONSTRAINT ON (n:LiteracyMaterial) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:LiteracyMaterial) ASSERT n.id IS UNIQUE',

      'CREATE CONSTRAINT ON (n:LiteracyMaterial) ASSERT EXISTS(n.createdAt)',

      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',

      'CREATE CONSTRAINT ON (n:LiteracyName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:LiteracyName) ASSERT n.value IS UNIQUE',
    ];
  }

  async create(
    input: CreateLiteracyMaterial,
    session: Session
  ): Promise<LiteracyMaterial> {
    const checkLiteracy = await this.db
      .query()
      .match([node('literacyMaterial', 'LiteracyName', { value: input.name })])
      .return('literacyMaterial')
      .first();

    if (checkLiteracy) {
      throw new DuplicateException(
        'literacyMaterial.name',
        'Literacy with this name already exists'
      );
    }

    // create literacy-material
    const secureProps: Property[] = [
      {
        key: 'name',
        value: input.name,
        isPublic: true,
        isOrgPublic: true,
        label: 'LiteracyName',
      },
      {
        key: 'canDelete',
        value: true,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    try {
      const result = await this.db
        .query()
        .call(matchRequestingUser, session)
        .call(
          createBaseNode,
          await generateId(),
          ['LiteracyMaterial', 'Producible'],
          secureProps
        )
        .return('node.id as id')
        .first();

      if (!result) {
        throw new ServerException('failed to create a literacy material');
      }

      const dbLiteracyMaterial = new DbLiteracyMaterial();
      await this.authorizationService.processNewBaseNode(
        dbLiteracyMaterial,
        result.id,
        session.userId
      );

      await this.scriptureRefService.create(
        result.id,
        input.scriptureReferences,
        session
      );

      this.logger.debug(`literacy material created`, { id: result.id });
      return await this.readOne(result.id, session);
    } catch (exception) {
      this.logger.error(`Could not create literacy material`, {
        exception,
        userId: session.userId,
      });
      throw new ServerException(
        'Could not create literacy material',
        exception
      );
    }
  }

  async readOne(id: ID, session: Session): Promise<LiteracyMaterial> {
    this.logger.debug(`Read literacyMaterial`, {
      id,
      userId: session.userId,
    });

    const readLiteracyMaterial = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'LiteracyMaterial', { id })])
      .call(matchPropList)
      .return('node, propList')
      .asResult<StandardReadResult<DbPropsOfDto<LiteracyMaterial>>>();

    const result = await readLiteracyMaterial.first();

    if (!result) {
      throw new NotFoundException(
        'Could not find literacy material',
        'literacyMaterial.id'
      );
    }

    const scriptureReferences = await this.scriptureRefService.list(
      id,
      session
    );

    const securedProps = await this.authorizationService.secureProperties(
      LiteracyMaterial,
      result.propList,
      session
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...securedProps,
      scriptureReferences: {
        ...securedProps.scriptureReferences,
        value: scriptureReferences,
      },
      canDelete: await this.db.checkDeletePermission(id, session),
    };
  }

  async update(
    input: UpdateLiteracyMaterial,
    session: Session
  ): Promise<LiteracyMaterial> {
    const literacyMaterial = await this.readOne(input.id, session);
    const {
      scriptureReferences,
      ...literacyMaterialNoScrip
    } = literacyMaterial;
    const {
      scriptureReferences: changeScriptureRefOnly,
      ...changesNoScripRef
    } = input;
    const realChanges = await this.db.getActualChanges(
      literacyMaterialNoScrip,
      changesNoScripRef
    );
    await this.authorizationService.verifyCanEditChanges(
      LiteracyMaterial,
      literacyMaterialNoScrip,
      realChanges
    );
    await this.authorizationService.verifyCanEdit({
      resource: LiteracyMaterial,
      baseNode: literacyMaterial,
      prop: 'scriptureReferences',
    });
    await this.scriptureRefService.update(input.id, input.scriptureReferences);

    await this.db.updateProperties({
      type: 'LiteracyMaterial',
      object: literacyMaterial,
      changes: realChanges,
    });

    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const literacyMaterial = await this.readOne(id, session);

    if (!literacyMaterial) {
      throw new NotFoundException('Could not find Literacy Material');
    }

    const canDelete = await this.db.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Literacy Material'
      );

    try {
      await this.db.deleteNodeNew<LiteracyMaterial>({
        object: literacyMaterial,
      });
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }

    this.logger.debug(`deleted literacyMaterial with id`, { id });
  }

  async list(
    { filter, ...input }: LiteracyMaterialListInput,
    session: Session
  ): Promise<LiteracyMaterialListOutput> {
    const query = this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode('LiteracyMaterial'),
      ])
      .call(
        calculateTotalAndPaginateList,
        input,
        this.securedProperties,
        defaultSorter
      );

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }
}
