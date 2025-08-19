import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { Tool } from './dto';
import { ToolService } from './tool.service';

@LoaderFactory(() => Tool)
export class ToolLoader implements DataLoaderStrategy<Tool, ID<Tool>> {
  constructor(private readonly tools: ToolService) {}

  async loadMany(ids: ReadonlyArray<ID<Tool>>) {
    return await this.tools.readMany(ids);
  }
}
