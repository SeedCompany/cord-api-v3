import {
  Args,
  Mutation,
  Parent,
  Query,
  ResolveField,
  Resolver,
} from '@nestjs/graphql';
import { AnonSession, ID, IdArg, LoggedInSession, Session } from '../../common';
import { FieldZoneService, SecuredFieldZone } from '../field-zone';
import { SecuredUser, UserService } from '../user';
import {
  CreateFieldRegionInput,
  CreateFieldRegionOutput,
  FieldRegion,
  FieldRegionListInput,
  FieldRegionListOutput,
  UpdateFieldRegionInput,
  UpdateFieldRegionOutput,
} from './dto';
import { FieldRegionService } from './field-region.service';

@Resolver(FieldRegion)
export class FieldRegionResolver {
  constructor(
    private readonly fieldRegionService: FieldRegionService,
    private readonly fieldZoneService: FieldZoneService,
    private readonly userService: UserService
  ) {}

  @Query(() => FieldRegion, {
    description: 'Read one field region by id',
  })
  async fieldRegion(
    @AnonSession() session: Session,
    @IdArg() id: ID
  ): Promise<FieldRegion> {
    return await this.fieldRegionService.readOne(id, session);
  }

  @Query(() => FieldRegionListOutput, {
    description: 'Look up field regions',
  })
  async fieldRegions(
    @AnonSession() session: Session,
    @Args({
      name: 'input',
      type: () => FieldRegionListInput,
      defaultValue: FieldRegionListInput.defaultVal,
    })
    input: FieldRegionListInput
  ): Promise<FieldRegionListOutput> {
    return await this.fieldRegionService.list(input, session);
  }

  @ResolveField(() => SecuredUser)
  async director(
    @Parent() fieldRegion: FieldRegion,
    @AnonSession() session: Session
  ): Promise<SecuredUser> {
    const { value: id, ...rest } = fieldRegion.director;
    const value = id ? await this.userService.readOne(id, session) : undefined;
    return {
      value,
      ...rest,
    };
  }

  @ResolveField(() => SecuredFieldZone)
  async fieldZone(
    @Parent() region: FieldRegion,
    @AnonSession() session: Session
  ): Promise<SecuredFieldZone> {
    const { value: id, ...rest } = region.fieldZone;
    const value = id
      ? await this.fieldZoneService.readOne(id, session)
      : undefined;
    return {
      value,
      ...rest,
    };
  }

  @Mutation(() => CreateFieldRegionOutput, {
    description: 'Create a field region',
  })
  async createFieldRegion(
    @LoggedInSession() session: Session,
    @Args('input') { fieldRegion: input }: CreateFieldRegionInput
  ): Promise<CreateFieldRegionOutput> {
    const fieldRegion = await this.fieldRegionService.create(input, session);
    return { fieldRegion };
  }

  @Mutation(() => UpdateFieldRegionOutput, {
    description: 'Update a field region',
  })
  async updateFieldRegion(
    @LoggedInSession() session: Session,
    @Args('input') { fieldRegion: input }: UpdateFieldRegionInput
  ): Promise<UpdateFieldRegionOutput> {
    const fieldRegion = await this.fieldRegionService.update(input, session);
    return { fieldRegion };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a field region',
  })
  async deleteFieldRegion(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<boolean> {
    await this.fieldRegionService.delete(id, session);
    return true;
  }
}
