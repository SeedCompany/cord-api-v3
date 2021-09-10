import { Args, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { AnonSession, Session } from '../../common';
import { DataLoader, Loader } from '../../core';
import { FileNode, IFileNode, resolveDefinedFile, SecuredFile } from '../file';
import { LanguageService } from '../language';
import { SecuredLanguage } from '../language/dto';
import { ProductListInput, SecuredProductList } from '../product/dto';
import { LanguageEngagement } from './dto';
import { EngagementService } from './engagement.service';

@Resolver(LanguageEngagement)
export class LanguageEngagementResolver {
  constructor(
    private readonly engagements: EngagementService,
    private readonly languages: LanguageService
  ) {}

  @ResolveField(() => SecuredLanguage)
  async language(
    @Parent() engagement: LanguageEngagement,
    @AnonSession() session: Session
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
    @AnonSession() session: Session,
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
    @Loader(IFileNode) files: DataLoader<FileNode>
  ): Promise<SecuredFile> {
    return await resolveDefinedFile(files, engagement.pnp);
  }
}
