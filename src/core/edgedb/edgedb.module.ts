import { Module, OnModuleDestroy } from '@nestjs/common';
import { createClient } from 'edgedb';
import { Client, EdgeDb } from './reexports';

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
      provide: EdgeDb,
      useExisting: Client,
    },
  ],
  exports: [EdgeDb, Client],
})
export class EdgedbModule implements OnModuleDestroy {
  constructor(private readonly client: Client) {}

  async onModuleDestroy() {
    await this.client.close();
  }
}
