import { groupBy } from '@seedcompany/common';
import {
  type DataLoaderOptions,
  type DataLoaderStrategy,
} from '@seedcompany/data-loader';
import { type ID, type ObjectView, viewOfChangeset } from '~/common';
import { type ChangesetAware } from '../../components/changeset/dto';
import type { ResourceNameLike } from '../resources';

interface Key<Kind extends ResourceNameLike | object> {
  id: ID<Kind>;
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
  Kind extends ResourceNameLike | object = T,
> implements DataLoaderStrategy<T, Key<Kind>, string>
{
  abstract loadManyByView(
    ids: ReadonlyArray<ID<Kind>>,
    view: ObjectView,
  ): Promise<readonly T[]>;

  async loadMany(keys: ReadonlyArray<Key<Kind>>): Promise<readonly T[]> {
    const grouped = groupBy(keys, (key) => viewId(key.view));

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

  getOptions(): DataLoaderOptions<T, Key<Kind>, string> {
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
