import { Injectable, Scope } from '@nestjs/common';
import { ID } from '../../common';
import { OrderedNestDataLoader } from '../../core';
import { LiteracyMaterial } from './dto';
import { LiteracyMaterialService } from './literacy-material.service';

@Injectable({ scope: Scope.REQUEST })
export class LiteracyMaterialLoader extends OrderedNestDataLoader<LiteracyMaterial> {
  constructor(private readonly literacyMaterials: LiteracyMaterialService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.literacyMaterials.readMany(ids, this.session);
  }
}
