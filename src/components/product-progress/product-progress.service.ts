import { Injectable } from '@nestjs/common';
import { ID, Session } from '../../common';
import { ProductProgress, ProductProgressInput } from './dto';
import { ProductProgressRepository } from './product-progress.repository';

@Injectable()
export class ProductProgressService {
  constructor(private readonly repo: ProductProgressRepository) {}

  async readAllByReport(
    reportId: ID,
    _session: Session
  ): Promise<readonly ProductProgress[]> {
    return await this.repo.readAllProgressReportsByReport(reportId);
  }

  async readAllByProduct(
    productId: ID,
    _session: Session
  ): Promise<readonly ProductProgress[]> {
    return await this.repo.readAllProgressReportsByProduct(productId);
  }

  async readOne(
    reportId: ID,
    productId: ID,
    _session: Session
  ): Promise<ProductProgress> {
    return await this.repo.readOne(productId, reportId);
  }

  async update(input: ProductProgressInput) {
    return await this.repo.update(input);
  }
}
