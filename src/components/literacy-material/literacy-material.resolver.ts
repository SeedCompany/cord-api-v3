import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../common';
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
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<LiteracyMaterial> {
    return await this.literacyMaterialService.readOne(id, session);
  }

  @Query(() => LiteracyMaterialListOutput, {
    description: 'Look up literacy materials',
  })
  async literacyMaterials(
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => LiteracyMaterialListInput,
      defaultValue: LiteracyMaterialListInput.defaultVal,
    })
    input: LiteracyMaterialListInput
  ): Promise<LiteracyMaterialListOutput> {
    return this.literacyMaterialService.list(input, session);
  }

  @Mutation(() => CreateLiteracyMaterialOutput, {
    description: 'Create a literacy material',
  })
  async createLiteracyMaterial(
    @Session() session: ISession,
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
    @Session() session: ISession,
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
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<boolean> {
    await this.literacyMaterialService.delete(id, session);
    return true;
  }
}
