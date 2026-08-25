import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { mapSecuredValue } from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { UserLoader } from '../../user';
import { SecuredUser } from '../../user/dto';
import { GtlReportPracticum } from '../dto';

@Resolver(GtlReportPracticum)
export class GtlReportPracticumResolver {
  @ResolveField(() => SecuredUser, {
    description: 'The mentor involved in this practicum, if any',
  })
  async mentor(
    @Parent() practicum: GtlReportPracticum,
    @Loader(UserLoader) users: LoaderOf<UserLoader>,
  ): Promise<SecuredUser> {
    return await mapSecuredValue(practicum.mentor, ({ id }) => users.load(id));
  }
}
