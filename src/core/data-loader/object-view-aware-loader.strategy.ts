import { DataLoaderOptions } from '@seedcompany/data-loader';
import { groupBy } from 'lodash';
import { ID, ObjectView, viewOfChangeset } from '~/common';
import { ChangesetAware } from '../../components/changeset/dto';
import { SessionAwareLoaderStrategy } from './session-aware-loader.strategy';

interface Key {
  id: ID;
  view: ObjectView;
}

/**
 * A loader that can handle loading ObjectView aware objects.
 * "Handles" by grouping items to be loaded by their ObjectView.
 * This works well with our DB queries which are dynamic based on view, but
 * able to ask for multiple objects with a specific view.
 */
export abstract class ObjectViewAwareLoader<
  T extends ChangesetAware,
> extends SessionAwareLoaderStrategy<T, Key, string> {
  abstract loadManyByView(
    ids: readonly ID[],
    view: ObjectView,
  ): Promise<readonly T[]>;

  async loadMany(keys: readonly Key[]): Promise<readonly T[]> {
    const grouped = Object.values(groupBy(keys, (key) => viewId(key.view)));

    const items = await Promise.all(
      grouped.map(async (keys) => {
        return await this.loadManyByView(
          keys.map((key) => key.id),
          keys[0].view,
        );
      }),
    );
    return items.flat();
  }

  getOptions(): DataLoaderOptions<T, Key, string> {
    return {
      propertyKey: (obj: T) => ({
        id: obj.id,
        view: viewOfChangeset(obj.changeset),
      }),
      cacheKeyFn: ({ id, view }) => `${id}=${viewId(view)}`,
    };
  }
}

const viewId = (view: ObjectView) =>
  view.changeset ? `changeset=${view.changeset}` : 'active=true';
