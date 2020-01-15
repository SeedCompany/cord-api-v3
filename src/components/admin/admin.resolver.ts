import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { AdminService } from './admin.service';
import { PrepareDatabaseOutputDto } from './admin.dto';

@Resolver('Admin')
export class AdminResolver {
  constructor(private readonly adminService: AdminService) {}

  @Mutation(returns => PrepareDatabaseOutputDto, {
    description: 'Creates constraints and indexes in database',
  })
  async prepareDatabaseConstraintsAndIndexes(): Promise<
    PrepareDatabaseOutputDto
  > {
    return await this.adminService.prepareDatabaseConstraintsAndIndexes();
  }
}
