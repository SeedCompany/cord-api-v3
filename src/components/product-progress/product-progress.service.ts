import { Injectable } from '@nestjs/common';
import { ID, Session } from '../../common';
import { ProductProgress, ProductProgressInput } from './dto';
import { ProductProgressRepository } from './product-progress.repository';

@Injectable()
export class ProductProgressService {
  constructor(private readonly repo: ProductProgressRepository) {}

  async readAllByReport(
    reportId: ID,
    session: Session
  ): Promise<readonly ProductProgress[]> {
    const productIds = await this.repo.readAllProgressReportsByReport(reportId);
    return await Promise.all(
      productIds.map(
        async (productId) => await this.readOne(reportId, productId, session)
      )
    );
  }

  async readAllByProduct(
    productId: ID,
    session: Session
  ): Promise<readonly ProductProgress[]> {
    const reportIds = await this.repo.readAllProgressReportsByProduct(
      productId
    );
    return await Promise.all(
      reportIds.map(
        async (reportId) => await this.readOne(reportId, productId, session)
      )
    );
  }

  async readOne(
    reportId: ID,
    productId: ID,
    _session: Session
  ): Promise<ProductProgress> {
    const steps = await this.repo.readSteps(productId, reportId);

    return {
      productId,
      reportId,
      steps,
    };
  }

  async update(input: ProductProgressInput) {
    await this.repo.removeOldProgress(input.productId, input.reportId);
    await this.repo.create(input);
  }
}
