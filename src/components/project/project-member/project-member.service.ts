import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { RelationDirection } from 'cypher-query-builder/dist/typings/clauses/relation-pattern';
import { difference } from 'lodash';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  generateId,
  ID,
  InputException,
  MaybeAsync,
  NotFoundException,
  ObjectView,
  SecuredList,
  ServerException,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '../../../common';
import {
  ConfigService,
  DatabaseService,
  HandleIdLookup,
  IEventBus,
  ILogger,
  Logger,
} from '../../../core';
import { ACTIVE } from '../../../core/database/query';
import { mapListResults } from '../../../core/database/results';
import { Powers, Role } from '../../authorization';
import { AuthorizationService } from '../../authorization/authorization.service';
import { User, UserService } from '../../user';
import {
  CreateProjectMember,
  ProjectMember,
  ProjectMemberListInput,
  ProjectMemberListOutput,
  UpdateProjectMember,
} from './dto';
import { ProjectMemberRepository } from './project-member.repository';

@Injectable()
export class ProjectMemberService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService,
    private readonly eventBus: IEventBus,
    @Logger('project:member:service') private readonly logger: ILogger,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    private readonly repo: ProjectMemberRepository
  ) {}

  protected async verifyRelationshipEligibility(
    projectId: ID,
    userId: ID
  ): Promise<void> {
    const result = await this.repo.verifyRelationshipEligibility(
      projectId,
      userId
    );

    if (!result?.project) {
      throw new NotFoundException(
        'Could not find project',
        'projectMember.projectId'
      );
    }

    if (!result?.user) {
      throw new NotFoundException(
        'Could not find person',
        'projectMember.userId'
      );
    }

    if (result.member) {
      throw new DuplicateException(
        'projectMember.userId',
        'Person is already a member of this project'
      );
    }
  }

  async create(
    { userId, projectId, ...input }: CreateProjectMember,
    session: Session
  ): Promise<ProjectMember> {
    await this.authorizationService.checkPower(Powers.CreateProject, session);
    const id = await generateId();
    const createdAt = DateTime.local();

    await this.verifyRelationshipEligibility(projectId, userId);

    await this.assertValidRoles(input.roles, () =>
      this.userService.readOne(userId, session)
    );

    try {
      const memberQuery = await this.repo.create(
        { userId, projectId, ...input },
        id,
        session,
        createdAt
      );
      if (!memberQuery) {
        throw new ServerException('Failed to create project member');
      }

      return await this.readOne(id, session);
    } catch (exception) {
      throw new ServerException('Could not create project member', exception);
    }
  }

  @HandleIdLookup(ProjectMember)
  async readOne(
    id: ID,
    session: Session,
    _view?: ObjectView
  ): Promise<ProjectMember> {
    this.logger.debug(`read one`, {
      id,
      userId: session.userId,
    });
    if (!id) {
      throw new NotFoundException(
        'No project member id to search for',
        'projectMember.id'
      );
    }

    const dto = await this.repo.readOne(id, session);
    return await this.secure(dto, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const projectMembers = await this.repo.readMany(ids, session);
    return await Promise.all(
      projectMembers.map((dto) => this.secure(dto, session))
    );
  }

  private async secure(
    dto: UnsecuredDto<ProjectMember>,
    session: Session
  ): Promise<ProjectMember> {
    const securedProps = await this.authorizationService.secureProperties(
      ProjectMember,
      dto,
      session
    );

    return {
      ...dto,
      ...securedProps,
      user: {
        ...securedProps.user,
        value: await this.userService.secure(dto.user, session),
      },
      roles: {
        ...securedProps.roles,
        value: securedProps.roles.value ?? [],
      },
      canDelete: await this.repo.checkDeletePermission(dto.id, session), // TODO
    };
  }

  async update(
    input: UpdateProjectMember,
    session: Session
  ): Promise<ProjectMember> {
    const object = await this.readOne(input.id, session);

    await this.assertValidRoles(input.roles, () => {
      const user = object.user.value;
      if (!user) {
        throw new UnauthorizedException(
          'Cannot read user to verify roles available'
        );
      }
      return user;
    });

    const changes = this.repo.getActualChanges(object, input);
    await this.authorizationService.verifyCanEditChanges(
      ProjectMember,
      object,
      changes
    );
    await this.repo.updateProperties(object, changes);
    return await this.readOne(input.id, session);
  }

  private async assertValidRoles(
    roles: Role[] | undefined,
    forUser: () => MaybeAsync<User>
  ) {
    if (!roles || roles.length === 0) {
      return;
    }
    const user = await forUser();
    const availableRoles = user.roles.value ?? [];
    const forbiddenRoles = difference(roles, availableRoles);
    if (forbiddenRoles.length) {
      const forbiddenRolesStr = forbiddenRoles.join(', ');
      throw new InputException(
        `Role(s) ${forbiddenRolesStr} cannot be assigned to this project member`,
        'input.roles'
      );
    }
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException(
        'Could not find project member',
        'projectMember.id'
      );
    }

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      this.logger.warning('Failed to delete project member', {
        exception,
      });

      throw new ServerException('Failed to delete project member', exception);
    }
  }

  async list(
    input: ProjectMemberListInput,
    session: Session
  ): Promise<ProjectMemberListOutput> {
    // Since there is no case at the present where there is global versus scoped canList,
    // not doing the whole limitedScope map thing for now.
    if (await this.authorizationService.canList(ProjectMember, session)) {
      const results = await this.repo.list(input, session);
      return await mapListResults(results, (dto) => this.secure(dto, session));
    } else {
      return SecuredList.Redacted;
    }
  }

  protected filterByProject(
    query: Query,
    projectId: ID,
    relationshipType: string,
    relationshipDirection: RelationDirection,
    label: string
  ) {
    query.match([
      node('project', 'Project', { id: projectId }),
      relation(relationshipDirection, '', relationshipType, ACTIVE),
      node('node', label),
    ]);
  }
}
