import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { MaybeAsync } from '@seedcompany/common';
import { difference } from 'lodash';
import {
  ID,
  InputException,
  NotFoundException,
  ObjectView,
  ServerException,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '~/common';
import { HandleIdLookup, ResourceLoader } from '~/core';
import { Privileges, Role } from '../../authorization';
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
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService & {},
    private readonly resources: ResourceLoader,
    private readonly privileges: Privileges,
    private readonly repo: ProjectMemberRepository,
  ) {}

  async create(
    input: CreateProjectMember,
    session: Session,
    enforcePerms = true,
  ): Promise<ProjectMember> {
    enforcePerms &&
      (await this.assertValidRoles(input.roles, () =>
        this.resources.load('User', input.userId),
      ));

    const created = await this.repo.create(input, session);

    enforcePerms &&
      this.privileges.for(session, ProjectMember, created).verifyCan('create');

    return this.secure(created, session);
  }

  @HandleIdLookup(ProjectMember)
  async readOne(
    id: ID,
    session: Session,
    _view?: ObjectView,
  ): Promise<ProjectMember> {
    if (!id) {
      throw new NotFoundException(
        'No project member id to search for',
        'projectMember.id',
      );
    }

    const dto = await this.repo.readOne(id, session);
    return this.secure(dto, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const projectMembers = await this.repo.readMany(ids, session);
    return projectMembers.map((dto) => this.secure(dto, session));
  }

  private secure(
    dto: UnsecuredDto<ProjectMember>,
    session: Session,
  ): ProjectMember {
    const { user, ...secured } = this.privileges
      .for(session, ProjectMember)
      .secure(dto);
    return {
      ...secured,
      user: {
        ...user,
        value:
          user.value && user.canRead
            ? this.userService.secure(
                user.value as unknown as UnsecuredDto<User>,
                session,
              )
            : undefined,
      },
    };
  }

  async update(
    input: UpdateProjectMember,
    session: Session,
  ): Promise<ProjectMember> {
    const object = await this.readOne(input.id, session);

    await this.assertValidRoles(input.roles, () => {
      const user = object.user.value;
      if (!user) {
        throw new UnauthorizedException(
          'Cannot read user to verify roles available',
        );
      }
      return user;
    });

    const changes = this.repo.getActualChanges(object, input);
    this.privileges.for(session, ProjectMember, object).verifyChanges(changes);

    const updated = await this.repo.update(
      { id: object.id, ...changes },
      session,
    );
    return this.secure(updated, session);
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
    const object = await this.readOne(id, session);

    this.privileges.for(session, ProjectMember, object).verifyCan('delete');

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      throw new ServerException('Failed to delete project member', exception);
    }
  }

  async list(
    input: ProjectMemberListInput,
    session: Session,
  ): Promise<ProjectMemberListOutput> {
    const results = await this.repo.list(input, session);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto, session)),
    };
  }
}
