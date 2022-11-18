import { Injectable } from '@nestjs/common';
import {
  ID,
  InputException,
  isIdLike,
  mapFromList,
  Session,
  UnauthorizedException,
  Variant,
} from '~/common';
import {
  HasScope,
  HasSensitivity,
  Privileges,
  UserResourcePrivileges,
  withVariant,
} from '../authorization';
import { Product } from '../product';
import type { ProgressReport } from '../progress-report/dto';
import {
  ProductProgress,
  ProductProgressInput,
  ProgressVariantByProductInput,
  ProgressVariantByProductOutput,
  ProgressVariantByReportInput,
  ProgressVariantByReportOutput,
  StepProgress,
  UnsecuredProductProgress,
} from './dto';
import {
  ProgressReportVariantProgress as Progress,
  ProgressVariant,
} from './dto/variant-progress.dto';
import { ProductProgressRepository } from './product-progress.repository';
import { StepNotPlannedException } from './step-not-planned.exception';

@Injectable()
export class ProductProgressService {
  constructor(
    private readonly privileges: Privileges,
    private readonly repo: ProductProgressRepository
  ) {}

  async readAllForManyReports(
    reports: readonly ProgressVariantByReportInput[],
    session: Session
  ): Promise<readonly ProgressVariantByReportOutput[]> {
    if (reports.length === 0) {
      return [];
    }
    const reportMap = mapFromList(reports, (r) => [r.report.id, r.report]);
    const rows = await this.repo.readAllProgressReportsForManyReports(reports);
    return rows.map((row): ProgressVariantByReportOutput => {
      const report = reportMap[row.reportId];
      return {
        report,
        variant: Progress.Variants.byKey(row.variant),
        details: row.progressList.map((progress) =>
          this.secure(progress, this.privilegesFor(session, report))
        ),
      };
    });
  }

  async readAllForManyProducts(
    products: readonly ProgressVariantByProductInput[],
    session: Session
  ): Promise<readonly ProgressVariantByProductOutput[]> {
    if (products.length === 0) {
      return [];
    }
    const productMap = mapFromList(products, (p) => [p.product.id, p.product]);
    const rows = await this.repo.readAllProgressReportsForManyProducts(
      products
    );
    return rows.map((row): ProgressVariantByProductOutput => {
      const product = productMap[row.productId];
      return {
        product,
        variant: Progress.Variants.byKey(row.variant),
        details: row.progressList.map((progress) =>
          this.secure(progress, this.privilegesFor(session, product))
        ),
      };
    });
  }

  async readOne(
    report: ID | ProgressReport,
    product: ID | Product,
    variant: Variant<ProgressVariant>,
    session: Session
  ): Promise<ProductProgress> {
    const productId = isIdLike(product) ? product : product.id;
    const reportId = isIdLike(report) ? report : report.id;
    const context = !isIdLike(product)
      ? product
      : !isIdLike(report)
      ? report
      : await this.repo.getScope(productId, session);

    const progress = await this.repo.readOne(productId, reportId, variant);
    return this.secure(progress, this.privilegesFor(session, context));
  }

  async readOneForCurrentReport(
    input: ProgressVariantByProductInput,
    session: Session
  ): Promise<ProductProgress | undefined> {
    const progress = await this.repo.readOneForCurrentReport(input);
    if (!progress) {
      return undefined;
    }
    return this.secure(progress, this.privilegesFor(session, input.product));
  }

  async update(input: ProductProgressInput, session: Session) {
    const scope = await this.repo.getScope(input.productId, session);
    const privileges = this.privilegesFor(
      session,
      withVariant(scope, input.variant)
    );
    if (!privileges.can('edit', 'completed')) {
      throw new UnauthorizedException(
        `You do not have the permission to update the "${input.variant.label}" variant of this goal's progress`
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
    const vp = privileges.forContext(
      withVariant(privileges.context!, progress.variant)
    );
    return {
      ...progress,
      variant: Progress.Variants.byKey(progress.variant),
      steps: progress.steps.map((step) => vp.secure(step)),
    };
  }

  private privilegesFor(
    session: Session,
    context: HasSensitivity & HasScope
  ): UserResourcePrivileges<typeof StepProgress> {
    return this.privileges.for(session, StepProgress, context as any);
  }
}
