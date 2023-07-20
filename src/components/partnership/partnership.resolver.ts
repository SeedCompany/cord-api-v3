import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import {
  AnonSession,
  ListArg,
  LoggedInSession,
  mapSecuredValue,
  SecuredDateRange,
  Session,
  viewOfChangeset,
} from '../../common';
import { Loader, LoaderOf } from '../../core';
import { ChangesetIds, IdsAndView, IdsAndViewArg } from '../changeset/dto';
import { FileNodeLoader, resolveDefinedFile, SecuredFile } from '../file';
import { PartnerLoader, SecuredPartner } from '../partner';
import { PartnershipLoader, PartnershipService } from '../partnership';
import {
  CreatePartnershipInput,
  CreatePartnershipOutput,
  DeletePartnershipOutput,
  Partnership,
  PartnershipListInput,
  PartnershipListOutput,
  UpdatePartnershipInput,
  UpdatePartnershipOutput,
} from './dto';

@Resolver(Partnership)
export class PartnershipResolver {
  constructor(private readonly service: PartnershipService) {}

  @Mutation(() => CreatePartnershipOutput, {
    description: 'Create a Partnership entry',
  })
  async createPartnership(
    @LoggedInSession() session: Session,
    @Args('input') { partnership: input, changeset }: CreatePartnershipInput,
  ): Promise<CreatePartnershipOutput> {
    const partnership = await this.service.create(input, session, changeset);
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
    return await mapSecuredValue(partnership.partner, (id) =>
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
    @AnonSession() session: Session,
    @ListArg(PartnershipListInput) input: PartnershipListInput,
    @Loader(PartnershipLoader) partnerships: LoaderOf<PartnershipLoader>,
  ): Promise<PartnershipListOutput> {
    const list = await this.service.list(input, session);
    partnerships.primeAll(list.items);
    return list;
  }

  @Mutation(() => UpdatePartnershipOutput, {
    description: 'Update a Partnership',
  })
  async updatePartnership(
    @LoggedInSession() session: Session,
    @Args('input') { partnership: input, changeset }: UpdatePartnershipInput,
  ): Promise<UpdatePartnershipOutput> {
    const partnership = await this.service.update(
      input,
      session,
      viewOfChangeset(changeset),
    );
    return { partnership };
  }

  @Mutation(() => DeletePartnershipOutput, {
    description: 'Delete a Partnership',
  })
  async deletePartnership(
    @LoggedInSession() session: Session,
    @Args() { id, changeset }: ChangesetIds,
  ): Promise<DeletePartnershipOutput> {
    await this.service.delete(id, session, changeset);
    return { success: true };
  }
}
