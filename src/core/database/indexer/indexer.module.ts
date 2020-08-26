import { DiscoveryModule, DiscoveryService } from '@golevelup/nestjs-discovery';
import { Module, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '../..';
import { ILogger, Logger } from '../../logger';
import { DatabaseService } from '../database.service';
import { DB_INDEX_KEY } from './indexer.constants';

@Module({
  imports: [DiscoveryModule],
})
export class IndexerModule implements OnModuleInit {
  constructor(
    private readonly db: DatabaseService,
    private readonly discover: DiscoveryService,
    private readonly config: ConfigService,
    @Logger('database:indexer') private readonly logger: ILogger
  ) {}

  async onModuleInit() {
    if (!this.config.dbIndexesCreate) {
      return;
    }

    const discovered = await this.discover.providerMethodsWithMetaAtKey(
      DB_INDEX_KEY
    );
    this.logger.debug('Discovered indexers', { count: discovered.length });

    const indexers = discovered.map((h) => h.discoveredMethod);
    for (const { handler, methodName, parentClass } of indexers) {
      this.logger.debug('Running indexer', {
        class: parentClass.name,
        method: methodName,
      });
      const maybeStatements = await handler.call(parentClass.instance, {
        db: this.db,
        logger: this.logger,
      });
      const statements = maybeStatements
        ? Array.isArray(maybeStatements)
          ? maybeStatements
          : [maybeStatements]
        : [];
      for (const statement of statements) {
        await this.db.query().raw(statement).run();
      }
    }

    this.logger.debug('Finished indexing');
  }
}
