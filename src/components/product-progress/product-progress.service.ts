import { Injectable } from '@nestjs/common';
import {
  ID,
  InputException,
  isIdLike,
  mapFromList,
  Session,
  UnauthorizedException,
} from '../../common';
import {
  HasScope,
  HasSensitivity,
  Privileges,
  UserResourcePrivileges,
} from '../authorization';
import { Product } from '../product';
import type { ProgressReport } from '../progress-report/dto';
import {
  ProductProgress,
  ProductProgressInput,
  StepProgress,
  UnsecuredProductProgress,
} from './dto';
import { ProductProgressRepository } from './product-progress.repository';
import { StepNotPlannedException } from './step-not-planned.exception';

@Injectable()
export class ProductProgressService {
  constructor(
    private readonly privileges: Privileges,
    private readonly repo: ProductProgressRepository
  ) {}

  async readAllForManyReports(
    reports: readonly ProgressReport[],
    session: Session
  ) {
    if (reports.length === 0) {
      return [];
    }
    const reportMap = mapFromList(reports, (r) => [r.id, r]);
    const progressForManyReports =
      await this.repo.readAllProgressReportsForManyReports(
        reports.map((report) => report.id)
      );
    return progressForManyReports.map(({ reportId, progressList }) => {
      const report = reportMap[reportId];
      const progress = progressList.map((progress) =>
        this.secure(progress, this.privilegesFor(session, report))
      );
      return { report, progress };
    });
  }

  async readAllForManyProducts(products: readonly Product[], session: Session) {
    if (products.length === 0) {
      return [];
    }
    const productMap = mapFromList(products, (r) => [r.id, r]);
    const progressForManyProducts =
      await this.repo.readAllProgressReportsForManyProducts(
        products.map((product) => product.id)
      );
    return progressForManyProducts.map(({ productId, progressList }) => {
      const product = productMap[productId];
      const progress = progressList.map((progress) =>
        this.secure(progress, this.privilegesFor(session, product))
      );
      return { product, progress };
    });
  }

  async readOne(
    report: ID | ProgressReport,
    product: ID | Product,
    session: Session
  ): Promise<ProductProgress> {
    const productId = isIdLike(product) ? product : product.id;
    const reportId = isIdLike(report) ? report : report.id;
    const context = !isIdLike(product)
      ? product
      : !isIdLike(report)
      ? report
      : await this.repo.getScope(productId, session);

    const progress = await this.repo.readOne(productId, reportId);
    return this.secure(progress, this.privilegesFor(session, context));
  }

  async readOneForCurrentReport(
    product: Product,
    session: Session
  ): Promise<ProductProgress | undefined> {
    const progress = await this.repo.readOneForCurrentReport(product.id);
    if (!progress) {
      return undefined;
    }
    return this.secure(progress, this.privilegesFor(session, product));
  }

  async update(input: ProductProgressInput, session: Session) {
    const scope = await this.repo.getScope(input.productId, session);
    const privileges = this.privilegesFor(session, scope);
    if (!privileges.can('edit', 'completed')) {
      throw new UnauthorizedException(
        `You do not have permission to update this product's progress`
      );
    }

    const cleanedInput = {
      ...input,
      steps: input.steps.map((sp) => ({
        step: sp.step,
        // Handle BC change with field rename
        completed: sp.completed ?? sp.percentDone ?? null,
      })),
    };

    cleanedInput.steps.forEach((step, index) => {
      if (!scope.steps.includes(step.step)) {
        throw new StepNotPlannedException(input.productId, step.step, index);
      }
      if (step.completed && step.completed > scope.progressTarget) {
        throw new InputException(
          "Completed value cannot exceed product's progress target",
          `steps.${index}.completed`
        );
      }
    });

    const progress = await this.repo.update(cleanedInput);
    return this.secure(progress, this.privilegesFor(session, scope));
  }

  private secure(
    progress: UnsecuredProductProgress,
    privileges: UserResourcePrivileges<typeof StepProgress>
  ): ProductProgress {
    return {
      ...progress,
      steps: progress.steps.map((step) => privileges.secure(step)),
    };
  }

  private privilegesFor(
    session: Session,
    context: HasSensitivity & HasScope
  ): UserResourcePrivileges<typeof StepProgress> {
    return this.privileges.for(session, StepProgress, context as any);
  }
}
