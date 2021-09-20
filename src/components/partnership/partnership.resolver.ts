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
  LoggedInSession,
  mapSecuredValue,
  SecuredDateRange,
  Session,
  viewOfChangeset,
} from '../../common';
import { Loader, LoaderOf } from '../../core';
import { ChangesetIds, IdsAndView, IdsAndViewArg } from '../changeset/dto';
import { FileNodeLoader, resolveDefinedFile, SecuredFile } from '../file';
import { PartnerLoader } from '../partner';
import { SecuredPartner } from '../partner/dto';
import {
  CreatePartnershipInput,
  CreatePartnershipOutput,
  Partnership,
  PartnershipListInput,
  PartnershipListOutput,
  UpdatePartnershipInput,
  UpdatePartnershipOutput,
} from './dto';
import { PartnershipService } from './partnership.service';

@Resolver(Partnership)
export class PartnershipResolver {
  constructor(private readonly service: PartnershipService) {}

  @Mutation(() => CreatePartnershipOutput, {
    description: 'Create a Partnership entry',
  })
  async createPartnership(
    @LoggedInSession() session: Session,
    @Args('input') { partnership: input, changeset }: CreatePartnershipInput
  ): Promise<CreatePartnershipOutput> {
    const partnership = await this.service.create(input, session, changeset);
    return { partnership };
  }

  @Query(() => Partnership, {
    description: 'Look up a partnership by ID',
  })
  async partnership(
    @AnonSession() session: Session,
    @IdsAndViewArg() { id, view }: IdsAndView
  ): Promise<Partnership> {
    return await this.service.readOne(id, session, view);
  }

  @ResolveField(() => SecuredFile, {
    description: 'The MOU agreement',
  })
  async mou(
    @Parent() partnership: Partnership,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>
  ): Promise<SecuredFile> {
    return await resolveDefinedFile(files, partnership.mou);
  }

  @ResolveField(() => SecuredFile, {
    description: 'The partner agreement',
  })
  async agreement(
    @Parent() partnership: Partnership,
    @Loader(FileNodeLoader) files: LoaderOf<FileNodeLoader>
  ): Promise<SecuredFile> {
    return await resolveDefinedFile(files, partnership.agreement);
  }

  @ResolveField(() => SecuredPartner)
  async partner(
    @Parent() partnership: Partnership,
    @Loader(PartnerLoader) partners: LoaderOf<PartnerLoader>
  ): Promise<SecuredPartner> {
    return await mapSecuredValue(partnership.partner, (id) =>
      partners.load(id)
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
      partnership.mouEndOverride
    );
  }

  @Query(() => PartnershipListOutput, {
    description: 'Look up partnerships',
  })
  async partnerships(
    @AnonSession() session: Session,
    @Args({
      name: 'input',
      type: () => PartnershipListInput,
      defaultValue: PartnershipListInput.defaultVal,
    })
    input: PartnershipListInput
  ): Promise<PartnershipListOutput> {
    return await this.service.list(input, session);
  }

  @Mutation(() => UpdatePartnershipOutput, {
    description: 'Update a Partnership',
  })
  async updatePartnership(
    @LoggedInSession() session: Session,
    @Args('input') { partnership: input, changeset }: UpdatePartnershipInput
  ): Promise<UpdatePartnershipOutput> {
    const partnership = await this.service.update(
      input,
      session,
      viewOfChangeset(changeset)
    );
    return { partnership };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a Partnership',
  })
  async deletePartnership(
    @LoggedInSession() session: Session,
    @Args() { id, changeset }: ChangesetIds
  ): Promise<boolean> {
    await this.service.delete(id, session, changeset);
    return true;
  }
}
