import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { AdminService } from './admin.service';
import { AdminOutputDto } from './admin.dto';

@Resolver('Admin')
export class AdminResolver {
  constructor(private readonly adminService: AdminService) {}

  @Mutation(returns => AdminOutputDto, {
    description: 'Creates constraints and indexes in database',
  })
  async prepareDatabaseConstraintsAndIndexes(): Promise<
  AdminOutputDto
  > {
    return await this.adminService.prepareDatabaseConstraintsAndIndexes();
  }

  @Mutation(returns => AdminOutputDto, {
    description: 'Load fake data for testing',
  })
  async loadFakeData(): Promise<
  AdminOutputDto
  > {
    return await this.adminService.loadFakeData();
  }

  @Mutation(returns => AdminOutputDto, {
    description: 'test all nodes and relationships for rule violations',
  })
  async consistencyCheck(): Promise<
  AdminOutputDto
  > {
    return await this.adminService.consistencyCheck();
  }

  @Mutation(returns => AdminOutputDto, {
    description: 'test all nodes and relationships for rule violations',
  })
  async deleteAllData(): Promise<
  AdminOutputDto
  > {
    return await this.adminService.deleteAllData();
  }

  @Mutation(returns => AdminOutputDto, {
    description: 'test all nodes and relationships for rule violations',
  })
  async removeAllConstraintsAndIndexes(): Promise<
  AdminOutputDto
  > {
    return await this.adminService.removeAllConstraintsAndIndexes();
  }
}
