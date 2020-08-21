import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../common';
import { FileService, SecuredFile } from '../file';
import { Organization, OrganizationService } from '../organization';
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
  constructor(
    private readonly service: PartnershipService,
    private readonly files: FileService,
    private readonly organizations: OrganizationService
  ) {}

  @Mutation(() => CreatePartnershipOutput, {
    description: 'Create a Partnership entry',
  })
  async createPartnership(
    @Session() session: ISession,
    @Args('input') { partnership: input }: CreatePartnershipInput
  ): Promise<CreatePartnershipOutput> {
    const partnership = await this.service.create(input, session);
    return { partnership };
  }

  @Query(() => Partnership, {
    description: 'Look up a partnership by ID',
  })
  async partnership(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<Partnership> {
    return await this.service.readOne(id, session);
  }

  @ResolveField(() => SecuredFile, {
    description: 'The MOU agreement',
  })
  async mou(
    @Parent() partnership: Partnership,
    @Session() session: ISession
  ): Promise<SecuredFile> {
    return await this.files.resolveDefinedFile(partnership.mou, session);
  }

  @ResolveField(() => SecuredFile, {
    description: 'The partner agreement',
  })
  async agreement(
    @Parent() partnership: Partnership,
    @Session() session: ISession
  ): Promise<SecuredFile> {
    return await this.files.resolveDefinedFile(partnership.agreement, session);
  }

  //TODO: implement resolver to read child organization if it won't break the list reads
  @ResolveField(() => Organization)
  async organization(
    @Parent()
    partnership: Partnership,
    @Session() session: ISession
  ): Promise<Organization> {
    const orgId = partnership.organization;
    return await this.organizations.readOne(orgId, session);
  }

  @Query(() => PartnershipListOutput, {
    description: 'Look up partnerships',
  })
  async partnerships(
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => PartnershipListInput,
      defaultValue: PartnershipListInput.defaultVal,
    })
    input: PartnershipListInput
  ): Promise<PartnershipListOutput> {
    return this.service.list(input, session);
  }

  @Mutation(() => UpdatePartnershipOutput, {
    description: 'Update a Partnership',
  })
  async updatePartnership(
    @Session() session: ISession,
    @Args('input') { partnership: input }: UpdatePartnershipInput
  ): Promise<UpdatePartnershipOutput> {
    const partnership = await this.service.update(input, session);
    return { partnership };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a Partnership',
  })
  async deletePartnership(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<boolean> {
    await this.service.delete(id, session);
    return true;
  }

  @Query(() => Boolean, {
    description: 'Check partnership node consistency',
  })
  async checkPartnershipConsistency(
    @Session() session: ISession
  ): Promise<boolean> {
    return await this.service.checkPartnershipConsistency(session);
  }
}
