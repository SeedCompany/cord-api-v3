import {
  DiscoveredMethodWithMeta,
  DiscoveryModule,
  DiscoveryService,
} from '@golevelup/nestjs-discovery';
import { Module, OnModuleInit } from '@nestjs/common';
import { groupToMapBy } from '@seedcompany/common';
import { many } from '~/common';
import { ConfigService } from '../../config/config.service';
import { ILogger, Logger } from '../../logger';
import { DatabaseService, ServerInfo } from '../database.service';
import { IndexMode } from './create-indexes.decorator';
import { DB_INDEX_KEY } from './indexer.constants';

@Module({
  imports: [DiscoveryModule],
})
export class IndexerModule implements OnModuleInit {
  constructor(
    private readonly db: DatabaseService,
    private readonly discover: DiscoveryService,
    private readonly config: ConfigService,
    @Logger('database:indexer') private readonly logger: ILogger,
  ) {}

  async onModuleInit() {
    if (!this.config.dbIndexesCreate) {
      return;
    }

    const discovered =
      await this.discover.providerMethodsWithMetaAtKey<IndexMode>(DB_INDEX_KEY);
    this.logger.debug('Discovered indexers', { count: discovered.length });
    const groupedByMode = groupToMapBy(discovered, (d) => d.meta);

    const finishing = this.db.runOnceUntilCompleteAfterConnecting(
      async (serverInfo) => {
        for (const [mode, discoveredOfMode] of groupedByMode.entries()) {
          await this.db.conn.runInTransaction(
            () => this.doIndexing(discoveredOfMode, serverInfo),
            {
              queryLogger: this.logger,
            },
          );
          this.logger.debug(`Finished syncing ${mode} indexes`);
        }
      },
    );
    // Wait for indexing to finish when running tests, else just let it run in
    // background and allow webserver to start.
    if (this.config.jest || this.config.isRepl) {
      await finishing;
    } else {
      finishing.catch((exception) => {
        this.logger.error('Failed to apply indexes', {
          exception,
        });
      });
    }
  }

  async doIndexing(
    discovered: ReadonlyArray<DiscoveredMethodWithMeta<unknown>>,
    serverInfo: ServerInfo,
  ) {
    const indexers = discovered.map((h) => h.discoveredMethod);
    for (const { handler, methodName, parentClass } of indexers) {
      const maybeStatements = await handler.call(parentClass.instance, {
        db: this.db,
        logger: this.logger,
        serverInfo,
      });
      const statements = many<string>(maybeStatements ?? []).map((statement) =>
        serverInfo.versionXY >= 4.4 || !statement.includes(' CONSTRAINT ')
          ? statement
          : statement.replace(' FOR ', ' ON ').replace(' REQUIRE ', ' ASSERT '),
      );
      for (const [i, statement] of Object.entries(statements)) {
        if (
          serverInfo.edition === 'community' &&
          statement.toUpperCase().includes('IS UNIQUE')
        ) {
          this.logger.debug(
            'Skipping constraint not supported on Neo4j Community Edition',
            { constraint: statement },
          );
          continue;
        }

        const indexName = statement.match(
          /create (?:index|constraint) ([\w_]+)/i,
        )?.[1];
        const src = `${parentClass.name}.${methodName}`;
        const indexStr = Number(i) > 0 ? ` #${Number(i) + 1}` : '';
        const name = indexName ? `${indexName} (${src})` : `${src}${indexStr}`;

        const q = this.db.query();
        (q as any).name = name;
        try {
          await q.raw(statement).run();
        } catch (e) {
          if (
            e.code === 'Neo.DatabaseError.Schema.ConstraintCreationFailed' &&
            e.message.includes('constraint requires Neo4j Enterprise Edition')
          ) {
            this.logger.debug(
              'Skipping constraint not supported on Neo4j Community Edition',
              { constraint: statement },
            );
          } else {
            this.logger.error('Failed to apply index', {
              index: name,
              exception: e,
            });
            throw e;
          }
        }
      }
    }
  }
}
