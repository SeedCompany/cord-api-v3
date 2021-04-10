import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AnonSession, IdArg, LoggedInSession, Session } from '../../../common';
import {
  CreatePropertyInput,
  CreatePropertyOutput,
  Property,
  PropertyListInput,
  PropertyListOutput,
  UpdatePropertyInput,
  UpdatePropertyOutput,
} from './dto';
import { PropertyService } from './property.service';

@Resolver()
export class PropertyResolver {
  constructor(private readonly service: PropertyService) {}

  @Mutation(() => CreatePropertyOutput, {
    description: 'Create a property',
  })
  async createProperty(
    @LoggedInSession() session: Session,
    @Args('input') { property: input }: CreatePropertyInput
  ): Promise<CreatePropertyOutput> {
    const property = await this.service.create(input, session);
    return { property };
  }

  @Query(() => Property, {
    description: 'Look up a property by ID',
  })
  async property(
    @AnonSession() session: Session,
    @IdArg() id: string
  ): Promise<Property> {
    return await this.service.readOne(id, session);
  }

  @Query(() => PropertyListOutput, {
    description: 'Look up properties',
  })
  async properties(
    @AnonSession() session: Session,
    @Args({
      name: 'input',
      type: () => PropertyListInput,
      defaultValue: PropertyListInput.defaultVal,
    })
    input: PropertyListInput
  ): Promise<PropertyListOutput> {
    return this.service.list(input, session);
  }

  @Mutation(() => UpdatePropertyOutput, {
    description: 'Update a property',
  })
  async updateProperty(
    @LoggedInSession() session: Session,
    @Args('input') { property: input }: UpdatePropertyInput
  ): Promise<UpdatePropertyOutput> {
    const property = await this.service.update(input, session);
    return { property };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a property',
  })
  async deleteProperty(
    @LoggedInSession() session: Session,
    @IdArg() id: string
  ): Promise<boolean> {
    await this.service.delete(id, session);
    return true;
  }
}
