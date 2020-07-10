import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { IdArg, ISession, Session } from '../../common';
import {
  AddFavoriteInput,
  Favorite,
  FavoriteListInput,
  FavoriteListOutput,
} from './dto';
import { FavoriteService } from './favorite.service';

@Resolver(Favorite)
export class FavoriteResolver {
  constructor(private readonly favs: FavoriteService) {}

  @Mutation(() => String, {
    description: 'add an favorite',
  })
  async addFavorite(
    @Session() session: ISession,
    @Args('input') { favorite: input }: AddFavoriteInput
  ): Promise<string> {
    const favorite = await this.favs.add(input, session);
    return favorite;
  }

  @Query(() => FavoriteListOutput, {
    description: 'Look up favorites',
  })
  async favorites(
    @Session() session: ISession,
    @Args({
      name: 'input',
      type: () => FavoriteListInput,
      defaultValue: FavoriteListInput.defaultVal,
    })
    input: FavoriteListInput
  ): Promise<FavoriteListOutput> {
    return this.favs.list(input, session);
  }

  @Mutation(() => Boolean, {
    description: 'Delete an favorite',
  })
  async removeFavorite(
    @Session() session: ISession,
    @IdArg() id: string
  ): Promise<boolean> {
    await this.favs.remove(id, session);
    return true;
  }
}
