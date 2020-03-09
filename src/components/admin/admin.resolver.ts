import { Mutation, Resolver } from '@nestjs/graphql';
import { AdminOutputDto } from './admin.dto';
import { AdminService } from './admin.service';

@Resolver('Admin')
export class AdminResolver {
  constructor(private readonly adminService: AdminService) {}

  @Mutation(() => AdminOutputDto, {
    description: 'Creates constraints and indexes in database',
  })
  async prepareDatabaseConstraintsAndIndexes(): Promise<AdminOutputDto> {
    return await this.adminService.prepareDatabaseConstraintsAndIndexes();
  }

  @Mutation(() => AdminOutputDto, {
    description: 'Load fake data for testing',
  })
  async loadFakeData(): Promise<AdminOutputDto> {
    return await this.adminService.loadFakeData();
  }

  @Mutation(() => AdminOutputDto, {
    description: 'test all nodes and relationships for rule violations',
  })
  async consistencyCheck(): Promise<AdminOutputDto> {
    return await this.adminService.consistencyCheck();
  }

  @Mutation(() => AdminOutputDto, {
    description: 'test all nodes and relationships for rule violations',
  })
  async deleteAllData(): Promise<AdminOutputDto> {
    return await this.adminService.deleteAllData();
  }

  @Mutation(() => AdminOutputDto, {
    description: 'test all nodes and relationships for rule violations',
  })
  async removeAllConstraintsAndIndexes(): Promise<AdminOutputDto> {
    return await this.adminService.removeAllConstraintsAndIndexes();
  }
}
