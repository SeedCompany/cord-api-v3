import { Module, OnModuleDestroy } from '@nestjs/common';
import { createClient } from 'edgedb';
import { Client, EdgeDB } from './reexports';

@Module({
  providers: [
    {
      provide: Client,
      useFactory: () => {
        const client = createClient();
        return client;
      },
    },
    {
      provide: EdgeDB,
      useExisting: Client,
    },
  ],
  exports: [EdgeDB, Client],
})
export class EdgeDBModule implements OnModuleDestroy {
  constructor(private readonly client: Client) {}

  async onModuleDestroy() {
    await this.client.close();
  }
}
