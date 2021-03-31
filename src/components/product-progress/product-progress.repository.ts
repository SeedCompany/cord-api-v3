import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../core';

@Injectable()
export class ProductProgressRepository {
  constructor(private readonly db: DatabaseService) {}
}
