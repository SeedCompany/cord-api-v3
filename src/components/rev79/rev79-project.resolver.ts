import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { SeedApiService } from '~/core/seed-api';
import { IProject, type Project } from '../project/dto';
import { Rev79Community } from './dto/rev79-community.dto';

const rev79CommunitiesQuery = /* GraphQL */ `
  query Rev79Projects($filter: JSONObject) {
    rev79Projects(filter: $filter) {
      id
      communitiesInUse {
        id
        name
      }
    }
  }
`;

@Resolver(IProject)
export class Rev79ProjectResolver {
  constructor(private readonly seedApi: SeedApiService) {}

  @ResolveField(() => [Rev79Community])
  async rev79Communities(
    @Parent() project: Project,
  ): Promise<Rev79Community[]> {
    const rev79ProjectId = project.rev79ProjectId.value;
    if (!rev79ProjectId) return [];

    const data = await this.seedApi.query<{
      rev79Projects: Array<{ id: string; communitiesInUse: Rev79Community[] }>;
    }>(rev79CommunitiesQuery, { filter: { id: rev79ProjectId } });

    return data?.rev79Projects[0]?.communitiesInUse ?? [];
  }
}
