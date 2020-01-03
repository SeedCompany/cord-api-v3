import { Resolver, Args, Query, Mutation } from '@nestjs/graphql';
import { Area } from '../../model/area';
import { AreaService } from './area.service';
import {
  CreateAreaInputDto,
  CreateAreaOutputDto,
  ReadAreaInputDto,
  ReadAreaOutputDto,
  UpdateAreaInputDto,
  UpdateAreaOutputDto,
  DeleteAreaInputDto,
  DeleteAreaOutputDto,
} from './area.dto';

@Resolver(of => Area)
export class AreaResolver {
  constructor(private readonly areaService: AreaService) {
  }

  @Mutation(returns => CreateAreaOutputDto, {
    description: 'Create a Area',
  })
  async createArea(
    @Args('input') { area: input }: CreateAreaInputDto,
  ): Promise<CreateAreaOutputDto> {
    return await this.areaService.create(input);
  }

  @Query(returns => ReadAreaOutputDto, {
    description: 'Read one Area by id',
  })
  async readArea(
    @Args('input') { area: input }: ReadAreaInputDto,
  ): Promise<ReadAreaOutputDto> {
    return await this.areaService.readOne(input);
  }

  @Mutation(returns => UpdateAreaOutputDto, {
    description: 'Update an Area',
  })
  async updateArea(
    @Args('input')
      { area: input }: UpdateAreaInputDto,
  ): Promise<UpdateAreaOutputDto> {
    return await this.areaService.update(input);
  }

  @Mutation(returns => DeleteAreaOutputDto, {
    description: 'Delete an Area',
  })
  async deleteArea(
    @Args('input')
      { area: input }: DeleteAreaInputDto,
  ): Promise<DeleteAreaOutputDto> {
    return await this.areaService.delete(input);
  }
}
