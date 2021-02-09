import {
  DiscoveredMethodWithMeta,
  DiscoveryModule,
  DiscoveryService,
} from '@golevelup/nestjs-discovery';
import { Module, OnModuleInit } from '@nestjs/common';
import { Neo4jError } from 'neo4j-driver';
import { ConfigService } from '../..';
import { many } from '../../../common';
import { ILogger, Logger } from '../../logger';
import { DatabaseService, ServerInfo } from '../database.service';
import { Transactional } from '../transactional.decorator';
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

    const finishing = this.db.runOnceUntilCompleteAfterConnecting(async () => {
      const serverInfo = await this.db.getServerInfo();
      await this.doIndexing(discovered, serverInfo);
    });
    // Wait for indexing to finish when running tests, else just let it run in
    // background and allow webserver to start.
    if (this.config.jest) {
      await finishing;
    } else {
      finishing.catch((exception) => {
        this.logger.error('Failed to apply indexes', {
          exception,
        });
      });
    }
  }

  @Transactional()
  async doIndexing(
    discovered: Array<DiscoveredMethodWithMeta<unknown>>,
    serverInfo: ServerInfo
  ) {
    const isV4 = serverInfo.version.startsWith('4');

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
      const statements = many<string>(maybeStatements ?? []).map((statement) =>
        isV4
          ? statement.replace(
              'CREATE CONSTRAINT ON ',
              'CREATE CONSTRAINT IF NOT EXISTS ON '
            )
          : statement
      );
      for (const statement of statements) {
        if (
          serverInfo.edition === 'community' &&
          statement.toUpperCase().includes('IS UNIQUE')
        ) {
          this.logger.debug(
            'Skipping constraint not supported on Neo4j Community Edition',
            { constraint: statement }
          );
          continue;
        }

        try {
          await this.db.query().raw(statement).run();
        } catch (e) {
          if (
            e instanceof Neo4jError &&
            e.code === 'Neo.DatabaseError.Schema.ConstraintCreationFailed' &&
            e.message.includes('constraint requires Neo4j Enterprise Edition')
          ) {
            this.logger.debug(
              'Skipping constraint not supported on Neo4j Community Edition',
              { constraint: statement }
            );
          } else {
            throw e;
          }
        }
      }
    }

    this.logger.debug('Finished indexing');
  }
}
