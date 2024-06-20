import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import {
  AnonSession,
  ListArg,
  mapSecuredValue,
  Session,
  viewOfChangeset,
} from '~/common';
import { Loader, LoaderOf } from '~/core';
import { FileNodeLoader, resolveDefinedFile } from '../file';
import { SecuredFile } from '../file/dto';
import { LanguageLoader } from '../language';
import { SecuredLanguage } from '../language/dto';
import { ProductLoader } from '../product';
import { ProductListInput, SecuredProductList } from '../product/dto';
import { LanguageEngagement } from './dto';
import { EngagementService } from './engagement.service';

@Resolver(LanguageEngagement)
export class LanguageEngagementResolver {
  constructor(private readonly engagements: EngagementService) {}

  @ResolveField(() => SecuredLanguage)
  async language(
    @Parent() engagement: LanguageEngagement,
    @Loader(LanguageLoader) languages: LoaderOf<LanguageLoader>,
  ): Promise<SecuredLanguage> {
    return await mapSecuredValue(engagement.language, ({ id }) =>
      languages.load({ id, view: viewOfChangeset(engagement.changeset) }),
    );
  }

  @ResolveField(() => SecuredProductList)
  async products(
    @Parent() engagement: LanguageEngagement,
    @AnonSession() session: Session,
    @Loader(ProductLoader) products: LoaderOf<ProductLoader>,
    @ListArg(ProductListInput) input: ProductListInput,
  ): Promise<SecuredProductList> {
    const list = await this.engagements.listProducts(
      engagement,
      input,
      session,
    );
    products.primeAll(list.items);
    return list;
  }

  @ResolveField(() => SecuredFile)
  async pnp(
    @Parent() engagement: LanguageEngagement,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>,
  ): Promise<SecuredFile> {
    return await resolveDefinedFile(files, engagement.pnp);
  }
}
