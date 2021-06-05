import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { AnonSession, ID, IdArg, LoggedInSession, Session } from '../../common';
import { FileService, SecuredFile } from '../file';
import { SecuredPartner } from '../partner/dto';
import { PartnerService } from '../partner/partner.service';
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
    private readonly partners: PartnerService
  ) {}

  @Mutation(() => CreatePartnershipOutput, {
    description: 'Create a Partnership entry',
  })
  async createPartnership(
    @LoggedInSession() session: Session,
    @Args('input') { partnership: input }: CreatePartnershipInput
  ): Promise<CreatePartnershipOutput> {
    const partnership = await this.service.create(input, session);
    return { partnership };
  }

  @Query(() => Partnership, {
    description: 'Look up a partnership by ID',
  })
  async partnership(
    @AnonSession() session: Session,
    @IdArg() id: ID
  ): Promise<Partnership> {
    return await this.service.readOne(id, session);
  }

  @ResolveField(() => SecuredFile, {
    description: 'The MOU agreement',
  })
  async mou(
    @Parent() partnership: Partnership,
    @AnonSession() session: Session
  ): Promise<SecuredFile> {
    return await this.files.resolveDefinedFile(partnership.mou, session);
  }

  @ResolveField(() => SecuredFile, {
    description: 'The partner agreement',
  })
  async agreement(
    @Parent() partnership: Partnership,
    @AnonSession() session: Session
  ): Promise<SecuredFile> {
    return await this.files.resolveDefinedFile(partnership.agreement, session);
  }

  @ResolveField(() => SecuredPartner)
  async partner(
    @Parent()
    partnership: Partnership,
    @AnonSession() session: Session
  ): Promise<SecuredPartner> {
    const { value: id, ...rest } = partnership.partner;
    const value = id ? await this.partners.readOne(id, session) : undefined;
    return {
      value,
      ...rest,
    };
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
    return this.service.list(input, session);
  }

  @Mutation(() => UpdatePartnershipOutput, {
    description: 'Update a Partnership',
  })
  async updatePartnership(
    @LoggedInSession() session: Session,
    @Args('input') { partnership: input }: UpdatePartnershipInput
  ): Promise<UpdatePartnershipOutput> {
    const partnership = await this.service.update(input, session);
    return { partnership };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a Partnership',
  })
  async deletePartnership(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<boolean> {
    await this.service.delete(id, session);
    return true;
  }
}
