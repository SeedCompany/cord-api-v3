import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ISession, Session } from '../../common';
import { FileService, SecuredFile } from '../file';
import { LanguageService } from '../language';
import { SecuredLanguage } from '../language/dto';
import { ProductListInput, SecuredProductList } from '../product/dto';
import { LanguageEngagement } from './dto';
import { EngagementService } from './engagement.service';

@Resolver(LanguageEngagement)
export class LanguageEngagementResolver {
  constructor(
    private readonly engagements: EngagementService,
    private readonly languages: LanguageService,
    private readonly files: FileService
  ) {}

  @ResolveField(() => SecuredLanguage)
  async language(
    @Parent() engagement: LanguageEngagement,
    @Session() session: ISession
  ): Promise<SecuredLanguage> {
    const { value: id, ...rest } = engagement.language;
    const value = id ? await this.languages.readOne(id, session) : undefined;
    return {
      value,
      ...rest,
    };
  }

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
    return await this.files.resolveDefinedFile(engagement.pnp, session);
  }
}
