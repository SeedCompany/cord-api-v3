import { forwardRef, Inject, Injectable, UnauthorizedException } from "@nestjs/common";
import { MaybeAsync } from '@seedcompany/common';
import { difference } from 'lodash';
import { DateTime } from 'luxon';
import {
  generateId,
  ID,
  InputException,
  isIdLike,
  mapSecuredValue,
  NotFoundException,
  ObjectView,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../../common';
import { DbTypeOf, HandleIdLookup, ILogger, Logger } from '../../../core';
import { mapListResults } from '../../../core/database/results';
import { Privileges, Role } from '../../authorization';
import { User, UserRepository, UserService } from '../../user';
import { IProject } from '../dto';
import { ProjectService } from '../project.service';
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
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService & {},
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService & {},
    @Logger('project:member:service') private readonly logger: ILogger,
    readonly privileges: Privileges,
    private readonly repo: ProjectMemberRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async create(
    { userId, projectId: projectOrId, ...input }: CreateProjectMember,
    session: Session,
    enforcePerms = true,
  ): Promise<ProjectMember> {
    const projectId = isIdLike(projectOrId) ? projectOrId : projectOrId.id;
    const project = isIdLike(projectOrId)
      ? await this.projectService.readOneUnsecured(projectOrId, session)
      : projectOrId;

    enforcePerms &&
      this.privileges
        .for(session, IProject, project)
        .verifyCan('create', 'member');

    const id = await generateId();
    const createdAt = DateTime.local();
    await this.repo.verifyRelationshipEligibility(projectId, userId);

    enforcePerms &&
      (await this.assertValidRoles(input.roles, () => {
        return this.userService.readOne(userId, session);
      }));

    try {
      const memberQuery = await this.repo.create(
        { userId, projectId, ...input },
        id,
        session,
        createdAt,
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
    _view?: ObjectView,
  ): Promise<ProjectMember> {
    this.logger.debug(`read one`, {
      id,
      userId: session.userId,
    });
    if (!id) {
      throw new NotFoundException(
        'No project member id to search for',
        'projectMember.id',
      );
    }

    const dto = await this.repo.readOne(id, session);
    return await this.secure(dto, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const projectMembers = await this.repo.readMany(ids, session);
    return await Promise.all(
      projectMembers.map((dto) => this.secure(dto, session)),
    );
  }

  private async secure(dto: UnsecuredDto<ProjectMember>, session: Session) {
    const secured = this.privileges.for(session, ProjectMember).secure({
      ...dto,
      roles: dto.roles ?? [],
    });
    return {
      ...secured,
      // I think this needs to remain async because of the userService call
      user: await mapSecuredValue(secured.user, (user) =>
        this.userService.secure(user, session),
      ),
    };
  }

  async update(
    input: UpdateProjectMember,
    session: Session,
  ): Promise<DbTypeOf<ProjectMember>> {
    const object = await this.repo.readOne(input.id, session);

    await this.assertValidRoles(input.roles, () => {
      const user = object.user;
      if (!user) {
        throw new UnauthorizedException(
          'Cannot read user to verify roles available',
        );
      }
      return user as unknown as MaybeAsync<User>;
    });

    const changes = this.repo.getActualChanges(object, input);
    this.privileges.for(session, ProjectMember, object).verifyChanges(changes);
    return await this.repo.update(object, changes, session);
  }

  private async assertValidRoles(
    roles: readonly Role[] | undefined,
    forUser: () => MaybeAsync<User>,
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
        'input.roles',
      );
    }
  }

  async delete(id: ID, session: Session): Promise<void> {
    return await this.repo.delete(id, session);
  }

  async list(
    input: ProjectMemberListInput,
    session: Session,
  ): Promise<ProjectMemberListOutput> {
    const results = await this.repo.list(input, session);
    return await mapListResults(results, (dto) => this.secure(dto, session));
  }
}
