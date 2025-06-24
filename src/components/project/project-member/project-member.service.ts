import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { type MaybeAsync, setOf } from '@seedcompany/common';
import {
  type ID,
  InputException,
  NotFoundException,
  type ObjectView,
  Role,
  ServerException,
  UnauthorizedException,
  type UnsecuredDto,
} from '~/common';
import { HandleIdLookup, ResourceLoader } from '~/core';
import { Privileges } from '../../authorization';
import { UserService } from '../../user';
import { type User } from '../../user/dto';
import {
  type CreateProjectMember,
  ProjectMember,
  type ProjectMemberListInput,
  type ProjectMemberListOutput,
  type UpdateProjectMember,
} from './dto';
import { type MembershipByProjectAndUserInput } from './membership-by-project-and-user.loader';
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
    enforcePerms = true,
  ): Promise<ProjectMember> {
    enforcePerms &&
      (await this.assertValidRoles(input.roles, () =>
        this.resources.load('User', input.userId),
      ));

    const created = await this.repo.create(input);

    if (input.inactiveAt && input.inactiveAt < created.createdAt) {
      throw new InputException(
        'Inactive date cannot be before creation date',
        'projectMember.inactiveAt',
      );
    }

    enforcePerms &&
      this.privileges.for(ProjectMember, created).verifyCan('create');

    return this.secure(created);
  }

  @HandleIdLookup(ProjectMember)
  async readOne(id: ID, _view?: ObjectView): Promise<ProjectMember> {
    if (!id) {
      throw new NotFoundException(
        'No project member id to search for',
        'projectMember.id',
      );
    }

    const dto = await this.repo.readOne(id);
    return this.secure(dto);
  }

  async readMany(ids: readonly ID[]) {
    const projectMembers = await this.repo.readMany(ids);
    return projectMembers.map((dto) => this.secure(dto));
  }

  async readManyByProjectAndUser(
    input: readonly MembershipByProjectAndUserInput[],
  ) {
    const dtos = await this.repo.readManyByProjectAndUser(input);
    return dtos.map((dto) => ({
      id: { project: dto.project.id, user: dto.user.id },
      membership: this.secure(dto),
    }));
  }

  private secure(dto: UnsecuredDto<ProjectMember>): ProjectMember {
    const { user, ...secured } = this.privileges.for(ProjectMember).secure(dto);
    return {
      ...secured,
      user: {
        ...user,
        value:
          user.value && user.canRead
            ? this.userService.secure(
                user.value as unknown as UnsecuredDto<User>,
              )
            : undefined,
      },
    };
  }

  async update(input: UpdateProjectMember): Promise<ProjectMember> {
    const object = await this.readOne(input.id);

    await this.assertValidRoles(input.roles, () => {
      const user = object.user.value;
      if (!user) {
        throw new UnauthorizedException(
          'Cannot read user to verify roles available',
        );
      }
      return user;
    });

    if (input.inactiveAt && input.inactiveAt < object.createdAt) {
      throw new InputException(
        'Inactive date cannot be before creation date',
        'projectMember.inactiveAt',
      );
    }

    const changes = this.repo.getActualChanges(object, input);
    this.privileges.for(ProjectMember, object).verifyChanges(changes);

    const updated = await this.repo.update({ id: object.id, ...changes });
    return this.secure(updated);
  }

  getAvailableRoles(user: User) {
    const availableRoles = (user.roles.value ?? []).flatMap((role: Role) =>
      Object.values(Role.Hierarchies)
        .flatMap((hierarchy: Role[]) => {
          const idx = hierarchy.indexOf(role);
          return idx > -1 ? hierarchy.slice(0, idx) : [];
        })
        .concat(role),
    );
    return setOf(availableRoles);
  }

  private async assertValidRoles(
    roles: readonly Role[] | undefined,
    forUser: () => MaybeAsync<User>,
  ) {
    if (!roles || roles.length === 0) {
      return;
    }
    const user = await forUser();
    const availableRoles = this.getAvailableRoles(user);
    const forbiddenRoles = setOf(roles).difference(availableRoles);
    if (forbiddenRoles.size > 0) {
      const forbiddenRolesStr = [...forbiddenRoles].join(', ');
      throw new InputException(
        `Role(s) ${forbiddenRolesStr} cannot be assigned to this project member`,
        'input.roles',
      );
    }
  }

  async delete(id: ID): Promise<void> {
    const object = await this.readOne(id);

    this.privileges.for(ProjectMember, object).verifyCan('delete');

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      throw new ServerException('Failed to delete project member', exception);
    }
  }

  async list(input: ProjectMemberListInput): Promise<ProjectMemberListOutput> {
    const results = await this.repo.list(input);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto)),
    };
  }
}
