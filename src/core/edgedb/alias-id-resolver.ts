import { Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import DataLoader from 'dataloader';
import { LRUCache as LRU } from 'lru-cache';
import { ID, NotFoundException } from '~/common';
import { IdResolver } from '~/common/validators/short-id.validator';
import { ILogger, Logger } from '~/core/logger';
import { EdgeDB } from './edgedb.service';
import { e } from './reexports';

@Injectable()
export class AliasIdResolver implements IdResolver {
  private readonly loader: DataLoader<ID, ID>;

  constructor(
    private readonly db: EdgeDB,
    @Logger('alias-resolver') private readonly logger: ILogger,
  ) {
    this.loader = new DataLoader((x) => this.loadMany(x), {
      // Since this loader exists for the lifetime of the process
      // and there's no cache invalidation, we'll just use an LRU cache
      cacheMap: new LRU({
        max: 10_000,
      }) as DataLoader.CacheMap<ID, Promise<ID>>,
    });
  }

  async resolve(value: ID): Promise<ID> {
    try {
      return await this.loader.load(value);
    } catch (e) {
      if (e instanceof NotFoundException) {
        this.loader.clear(value); // maybe it'll be there next request
        return value; // assume valid or defer error
      }
      throw e;
    }
  }

  async loadMany(ids: readonly ID[]): Promise<ReadonlyArray<ID | Error>> {
    const aliases = ids.filter((id) => {
      if (isUUID(id)) {
        return false;
      }
      return true;
    });
    if (aliases.length === 0) {
      return ids;
    }

    this.logger.info('Resolving aliases', { ids: aliases });
    const foundList = await this.db.run(this.query, { aliasList: aliases });
    return ids.map((id) => {
      const found = foundList.find((f) => f.name === id);
      return found
        ? found.targetId
        : !aliases.includes(id)
        ? id
        : new NotFoundException();
    });
  }

  private readonly query = e.params(
    { aliasList: e.array(e.str) },
    ({ aliasList }) =>
      e.select(e.Alias, (alias) => ({
        filter: e.op(alias.name, 'in', e.array_unpack(aliasList)),
        name: true,
        targetId: alias.target.id,
      })),
  );
}
