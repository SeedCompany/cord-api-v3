import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AnonSession, ID, IdArg, LoggedInSession, Session } from '../../common';
import { Loader, LoaderOf } from '../../core';
import {
  CreateLiteracyMaterialInput,
  CreateLiteracyMaterialOutput,
  LiteracyMaterial,
  LiteracyMaterialListInput,
  LiteracyMaterialListOutput,
  UpdateLiteracyMaterialInput,
  UpdateLiteracyMaterialOutput,
} from './dto';
import { LiteracyMaterialLoader } from './literacy-material.loader';
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
    @IdArg() id: ID,
    @Loader(LiteracyMaterialLoader)
    literacyMaterials: LoaderOf<LiteracyMaterialLoader>
  ): Promise<LiteracyMaterial> {
    return await literacyMaterials.load(id);
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
    input: LiteracyMaterialListInput,
    @Loader(LiteracyMaterialLoader)
    literacyMaterials: LoaderOf<LiteracyMaterialLoader>
  ): Promise<LiteracyMaterialListOutput> {
    const list = await this.literacyMaterialService.list(input, session);
    literacyMaterials.primeAll(list.items);
    return list;
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
