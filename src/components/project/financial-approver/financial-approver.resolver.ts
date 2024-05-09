import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { LoggedInSession, Session } from '~/common';
import { Loader, LoaderOf } from '~/core';
import { Privileges } from '../../authorization';
import { User, UserLoader } from '../../user';
import { ProjectType } from '../dto/project-type.enum';
import { FinancialApprover, FinancialApproverInput } from './dto';
import { FinancialApproverRepository } from './financial-approver.repository';

@Resolver(FinancialApprover)
export class FinancialApproverResolver {
  constructor(
    private readonly repo: FinancialApproverRepository,
    private readonly privileges: Privileges,
  ) {}

  @Query(() => [FinancialApprover])
  async projectTypeFinancialApprovers(
    @Args({
      name: 'projectTypes',
      type: () => [ProjectType],
      nullable: true,
    })
    types: readonly ProjectType[] | undefined,
    @LoggedInSession() _: Session, // require login
  ): Promise<readonly FinancialApprover[]> {
    return await this.repo.read(types);
  }

  @Mutation(() => FinancialApprover, {
    description: 'Set a user as a financial approver for some project types',
    nullable: true,
  })
  async setProjectTypeFinancialApprover(
    @Args('input') input: FinancialApproverInput,
    @LoggedInSession() session: Session,
  ): Promise<FinancialApprover | null> {
    this.privileges.for(session, FinancialApprover).verifyCan('edit');
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
