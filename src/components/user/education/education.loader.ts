import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { Education } from './dto';
import { EducationService } from './education.service';

@LoaderFactory(() => Education)
export class EducationLoader
  implements DataLoaderStrategy<Education, ID<Education>>
{
  constructor(private readonly educations: EducationService) {}

  async loadMany(ids: ReadonlyArray<ID<Education>>) {
    return await this.educations.readMany(ids);
  }
}
