import { Injectable } from '@nestjs/common';
import {
  ID,
  mapFromList,
  NotImplementedException,
  Session,
} from '../../common';
import { ProductProgress, ProductProgressInput } from './dto';
import { ProductProgressRepository } from './product-progress.repository';

@Injectable()
export class ProductProgressService {
  constructor(private readonly repo: ProductProgressRepository) {}

  async readAllByReport(
    reportId: ID,
    session: Session
  ): Promise<readonly ProductProgress[]> {
    throw new NotImplementedException().with(reportId, session);
  }

  async readAllByProduct(
    productId: ID,
    session: Session
  ): Promise<readonly ProductProgress[]> {
    throw new NotImplementedException().with(productId, session);
  }

  async readOne(
    reportId: ID,
    productId: ID,
    session: Session
  ): Promise<ProductProgress> {
    throw new NotImplementedException().with(reportId, productId, session);
  }

  async update(input: ProductProgressInput, session: Session) {
    // TODO ensure all input.steps[].step are set on the product.
    // TODO ensure input.reportId is valid

    // Convert steps list to map. Use if useful, otherwise remove.
    const steps = mapFromList(input.steps, (pair) => [
      pair.step,
      pair.percentDone,
    ]);

    throw new NotImplementedException().with(input, session, steps);
  }
}
