import { type ID } from '~/common';
import {
  type DataLoaderStrategy,
  LoaderFactory,
  type LoaderOptionsOf,
} from '~/core/data-loader';
import { type ProjectMember } from './dto';
import { ProjectMemberService } from './project-member.service';

export interface MembershipByProjectAndUserInput {
  project: ID<'Project'>;
  user: ID<'User'>;
}

@LoaderFactory()
export class MembershipByProjectAndUserLoader implements DataLoaderStrategy<
  { id: MembershipByProjectAndUserInput; membership: ProjectMember },
  MembershipByProjectAndUserInput,
  string
> {
  constructor(private readonly service: ProjectMemberService) {}

  getOptions() {
    return {
      cacheKeyFn: (input) => `${input.project}:${input.user}`,
    } satisfies LoaderOptionsOf<MembershipByProjectAndUserLoader>;
  }

  async loadMany(input: readonly MembershipByProjectAndUserInput[]) {
    return await this.service.readManyByProjectAndUser(input);
  }
}
