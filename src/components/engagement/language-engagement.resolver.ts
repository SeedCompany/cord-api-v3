import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ISession, Session } from '../../common';
import { FileService, SecuredFile } from '../file';
import { ProductListInput, SecuredProductList } from '../product/dto';
import { LanguageEngagement } from './dto';
import { EngagementService } from './engagement.service';

@Resolver(LanguageEngagement)
export class LanguageEngagementResolver {
  constructor(
    private readonly engagements: EngagementService,
    private readonly files: FileService
  ) {}

  @ResolveField(() => SecuredProductList)
  async products(
    @Parent() engagement: LanguageEngagement,
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => ProductListInput,
      nullable: true,
    })
    input?: ProductListInput
  ): Promise<SecuredProductList> {
    return this.engagements.listProducts(
      engagement,
      input || ProductListInput.defaultVal,
      session
    );
  }

  @ResolveField(() => SecuredFile)
  async pnp(
    @Parent() engagement: LanguageEngagement,
    @Session() session: ISession
  ): Promise<SecuredFile> {
    return this.files.resolveDefinedFile(engagement.pnp, session);
  }
}
