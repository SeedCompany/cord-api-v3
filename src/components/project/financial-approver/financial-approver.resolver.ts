import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { Loader, type LoaderOf } from '~/core';
import { Identity } from '~/core/authentication';
import { Privileges } from '../../authorization';
import { UserLoader } from '../../user';
import { User } from '../../user/dto';
import { ProjectType } from '../dto/project-type.enum';
import { FinancialApprover, FinancialApproverInput } from './dto';
import { FinancialApproverRepository } from './financial-approver.repository';

@Resolver(FinancialApprover)
export class FinancialApproverResolver {
  constructor(
    private readonly repo: FinancialApproverRepository,
    private readonly privileges: Privileges,
    private readonly identity: Identity,
  ) {}

  @Query(() => [FinancialApprover])
  async projectTypeFinancialApprovers(
    @Args({
      name: 'projectTypes',
      type: () => [ProjectType],
      nullable: true,
    })
    types: readonly ProjectType[] | undefined,
  ): Promise<readonly FinancialApprover[]> {
    // TODO move to auth policy
    if (this.identity.isAnonymous) {
      return [];
    }
    return await this.repo.read(types);
  }

  @Mutation(() => FinancialApprover, {
    description: 'Set a user as a financial approver for some project types',
    nullable: true,
  })
  async setProjectTypeFinancialApprover(
    @Args('input') input: FinancialApproverInput,
  ): Promise<FinancialApprover | null> {
    this.privileges.for(FinancialApprover).verifyCan('edit');
    return await this.repo.write(input);
  }

  @ResolveField(() => User)
  async user(
    @Parent() { user }: FinancialApprover,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ): Promise<User> {
    return await users.load(user.id);
  }
}
