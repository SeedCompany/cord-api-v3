import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import {
  AnonSession,
  ID,
  IdArg,
  ListArg,
  LoggedInSession,
  Session,
} from '../../common';
import { Loader, LoaderOf } from '../../core';
import { EthnoArtLoader, EthnoArtService } from '../ethno-art';
import {
  CreateLiteracyMaterialInput,
  CreateLiteracyMaterialOutput,
  DeleteLiteracyMaterialOutput,
  LiteracyMaterial,
  LiteracyMaterialListInput,
  LiteracyMaterialListOutput,
  UpdateLiteracyMaterialInput,
  UpdateLiteracyMaterialOutput,
} from './dto';

@Resolver(LiteracyMaterial)
export class LiteracyMaterialResolver {
  constructor(private readonly ethnoArts: EthnoArtService) {}

  @Query(() => LiteracyMaterial, {
    description: 'Look up a literacy material',
    deprecationReason: 'Use `ethnoArt` instead',
  })
  async literacyMaterial(
    @IdArg() id: ID,
    @Loader(EthnoArtLoader) arts: LoaderOf<EthnoArtLoader>
  ): Promise<LiteracyMaterial> {
    return await arts.load(id);
  }

  @Query(() => LiteracyMaterialListOutput, {
    description: 'Look up literacy materials',
    deprecationReason: 'Use `ethnoArts` instead',
  })
  async literacyMaterials(
    @AnonSession() session: Session,
    @ListArg(LiteracyMaterialListInput) input: LiteracyMaterialListInput,
    @Loader(EthnoArtLoader) arts: LoaderOf<EthnoArtLoader>
  ): Promise<LiteracyMaterialListOutput> {
    const list = await this.ethnoArts.list(input, session);
    arts.primeAll(list.items);
    return list;
  }

  @Mutation(() => CreateLiteracyMaterialOutput, {
    description: 'Create a literacy material',
    deprecationReason: 'Use `createEthnoArt` instead',
  })
  async createLiteracyMaterial(
    @LoggedInSession() session: Session,
    @Args('input') { literacyMaterial: input }: CreateLiteracyMaterialInput
  ): Promise<CreateLiteracyMaterialOutput> {
    const literacyMaterial = await this.ethnoArts.create(input, session);
    return { literacyMaterial };
  }

  @Mutation(() => UpdateLiteracyMaterialOutput, {
    description: 'Update a literacy material',
    deprecationReason: 'Use `updateEthnoArt` instead',
  })
  async updateLiteracyMaterial(
    @LoggedInSession() session: Session,
    @Args('input') { literacyMaterial: input }: UpdateLiteracyMaterialInput
  ): Promise<UpdateLiteracyMaterialOutput> {
    const literacyMaterial = await this.ethnoArts.update(input, session);
    return { literacyMaterial };
  }

  @Mutation(() => DeleteLiteracyMaterialOutput, {
    description: 'Delete a literacy material',
    deprecationReason: 'Use `deleteEthnoArt` instead',
  })
  async deleteLiteracyMaterial(
    @LoggedInSession() session: Session,
    @IdArg() id: ID
  ): Promise<DeleteLiteracyMaterialOutput> {
    await this.ethnoArts.delete(id, session);
    return { success: true };
  }
}
