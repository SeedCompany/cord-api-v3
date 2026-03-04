import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  ListArg,
  mapSecuredValue,
  SecuredDateRange,
  viewOfChangeset,
} from '~/common';
import { Loader, type LoaderOf } from '~/core/data-loader';
import { ChangesetIds, type IdsAndView, IdsAndViewArg } from '../changeset/dto';
import { FileNodeLoader, resolveDefinedFile } from '../file';
import { SecuredFile } from '../file/dto';
import { PartnerLoader } from '../partner';
import { SecuredPartner } from '../partner/dto';
import { PartnershipLoader, PartnershipService } from '../partnership';
import {
  CreatePartnership,
  Partnership,
  PartnershipCreated,
  PartnershipDeleted,
  PartnershipListInput,
  PartnershipListOutput,
  PartnershipUpdated,
  UpdatePartnership,
} from './dto';

@Resolver(Partnership)
export class PartnershipResolver {
  constructor(private readonly service: PartnershipService) {}

  @Mutation(() => PartnershipCreated, {
    description: 'Create a Partnership entry',
  })
  async createPartnership(
    @Args('input') { changeset, ...input }: CreatePartnership,
  ): Promise<PartnershipCreated> {
    const partnership = await this.service.create(input, changeset);
    return { partnership };
  }

  @Query(() => Partnership, {
    description: 'Look up a partnership by ID',
  })
  async partnership(
    @Loader(PartnershipLoader) partnerships: LoaderOf<PartnershipLoader>,
    @IdsAndViewArg() key: IdsAndView,
  ): Promise<Partnership> {
    return await partnerships.load(key);
  }

  @ResolveField(() => SecuredFile, {
    description: 'The MOU agreement',
  })
  async mou(
    @Parent() partnership: Partnership,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>,
  ): Promise<SecuredFile> {
    return await resolveDefinedFile(files, partnership.mou);
  }

  @ResolveField(() => SecuredFile, {
    description: 'The partner agreement',
  })
  async agreement(
    @Parent() partnership: Partnership,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>,
  ): Promise<SecuredFile> {
    return await resolveDefinedFile(files, partnership.agreement);
  }

  @ResolveField(() => SecuredPartner)
  async partner(
    @Parent() partnership: Partnership,
    @Loader(PartnerLoader) partners: LoaderOf<PartnerLoader>,
  ): Promise<SecuredPartner> {
    return await mapSecuredValue(partnership.partner, ({ id }) =>
      partners.load(id),
    );
  }

  @ResolveField()
  mouRange(@Parent() partnership: Partnership): SecuredDateRange {
    return SecuredDateRange.fromPair(partnership.mouStart, partnership.mouEnd);
  }

  @ResolveField()
  mouRangeOverride(@Parent() partnership: Partnership): SecuredDateRange {
    return SecuredDateRange.fromPair(
      partnership.mouStartOverride,
      partnership.mouEndOverride,
    );
  }

  @Query(() => PartnershipListOutput, {
    description: 'Look up partnerships',
    deprecationReason: 'Query via project instead',
  })
  async partnerships(
    @ListArg(PartnershipListInput) input: PartnershipListInput,
    @Loader(PartnershipLoader) partnerships: LoaderOf<PartnershipLoader>,
  ): Promise<PartnershipListOutput> {
    const list = await this.service.list(input);
    partnerships.primeAll(list.items);
    return list;
  }

  @Mutation(() => PartnershipUpdated, {
    description: 'Update a Partnership',
  })
  async updatePartnership(
    @Args('input') { changeset, ...input }: UpdatePartnership,
  ): Promise<PartnershipUpdated> {
    const partnership = await this.service.update(
      input,
      viewOfChangeset(changeset),
    );
    return { partnership };
  }

  @Mutation(() => PartnershipDeleted, {
    description: 'Delete a Partnership',
  })
  async deletePartnership(
    @Args() { id, changeset }: ChangesetIds,
  ): Promise<PartnershipDeleted> {
    await this.service.delete(id, changeset);
    return {};
  }
}
