import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { ToolUsage } from './dto';
import { ToolUsageService } from './tool-usage.service';

@LoaderFactory(() => ToolUsage)
export class ToolUsageLoader implements DataLoaderStrategy<
  ToolUsage,
  ID<ToolUsage>
> {
  constructor(private readonly usages: ToolUsageService) {}

  async loadMany(ids: ReadonlyArray<ID<ToolUsage>>) {
    return await this.usages.readMany(ids);
  }
}
