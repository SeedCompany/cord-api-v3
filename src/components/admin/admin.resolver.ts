import { Mutation, Resolver } from '@nestjs/graphql';
import { AdminService } from './admin.service';

@Resolver()
export class AdminResolver {
  constructor(private readonly service: AdminService) {}

  @Mutation(() => Boolean, {
    description: 'Run the load data script',
  })
  async loadData(): Promise<boolean> {
    await this.service.loadData();
    return true;
  }
  @Mutation(() => Boolean, {
    description: 'Run the fast inserts script',
  })
  async fastInserts() {
    await this.service.fastInserts();
    return true;
  }
}
