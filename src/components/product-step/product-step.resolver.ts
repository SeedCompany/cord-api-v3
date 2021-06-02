import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ID, IdArg, LoggedInSession, Session } from '../../common';
import {
  CreateProductStepInput,
  CreateProductStepOutput,
  ProductStep,
} from './dto';
import { ProductStepService } from './product-step.service';

@Resolver(ProductStep)
export class ProductStepResolver {
  constructor(private readonly service: ProductStepService) {}

  @Mutation(() => CreateProductStepOutput, {
    description: 'Create a product step',
  })
  async createProductStep(
    @LoggedInSession() session: Session,
    @Args('input') { productStep: input }: CreateProductStepInput
  ): Promise<CreateProductStepOutput> {
    const productStep = await this.service.create(input, session);
    return { productStep };
  }

  @Query(() => ProductStep, {
    description: 'Look up a product step by ID',
  })
  async productStep(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<ProductStep> {
    return await this.service.readOne(id, session);
  }
}
