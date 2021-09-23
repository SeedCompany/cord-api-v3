import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AnonSession, ID, IdArg, LoggedInSession, Session } from '../../common';
import {
  CreateLiteracyMaterialInput,
  CreateLiteracyMaterialOutput,
  LiteracyMaterial,
  LiteracyMaterialListInput,
  LiteracyMaterialListOutput,
  UpdateLiteracyMaterialInput,
  UpdateLiteracyMaterialOutput,
} from './dto';
import { LiteracyMaterialService } from './literacy-material.service';

@Resolver(LiteracyMaterial)
export class LiteracyMaterialResolver {
  constructor(
    private readonly literacyMaterialService: LiteracyMaterialService
  ) {}

  @Query(() => LiteracyMaterial, {
    description: 'Look up a literacy material',
  })
  async literacyMaterial(
    @AnonSession() session: Session,
    @IdArg() id: ID
  ): Promise<LiteracyMaterial> {
    return await this.literacyMaterialService.readOne(id, session);
  }

  @Query(() => LiteracyMaterialListOutput, {
    description: 'Look up literacy materials',
  })
  async literacyMaterials(
    @AnonSession() session: Session,
    @Args({
      name: 'input',
      type: () => LiteracyMaterialListInput,
      defaultValue: LiteracyMaterialListInput.defaultVal,
    })
    input: LiteracyMaterialListInput
  ): Promise<LiteracyMaterialListOutput> {
    return await this.literacyMaterialService.list(input, session);
  }

  @Mutation(() => CreateLiteracyMaterialOutput, {
    description: 'Create a literacy material',
  })
  async createLiteracyMaterial(
    @LoggedInSession() session: Session,
    @Args('input') { literacyMaterial: input }: CreateLiteracyMaterialInput
  ): Promise<CreateLiteracyMaterialOutput> {
    const literacyMaterial = await this.literacyMaterialService.create(
      input,
      session
    );
    return { literacyMaterial };
  }

  @Mutation(() => UpdateLiteracyMaterialOutput, {
    description: 'Update a literacy material',
  })
  async updateLiteracyMaterial(
    @LoggedInSession() session: Session,
    @Args('input') { literacyMaterial: input }: UpdateLiteracyMaterialInput
  ): Promise<UpdateLiteracyMaterialOutput> {
    const literacyMaterial = await this.literacyMaterialService.update(
      input,
      session
    );
    return { literacyMaterial };
  }

  @Mutation(() => Boolean, {
    description: 'Delete a literacy material',
  })
  async deleteLiteracyMaterial(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<boolean> {
    await this.literacyMaterialService.delete(id, session);
    return true;
  }
}
