import { Injectable, Scope } from '@nestjs/common';
import { ID } from '../../../common';
import { OrderedNestDataLoader } from '../../../core';
import { Education } from './dto';
import { EducationService } from './education.service';

@Injectable({ scope: Scope.REQUEST })
export class EducationLoader extends OrderedNestDataLoader<Education> {
  constructor(private readonly educations: EducationService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.educations.readMany(ids, this.session);
  }
}
