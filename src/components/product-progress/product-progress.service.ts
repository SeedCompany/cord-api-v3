import { Injectable } from '@nestjs/common';
import {
  ID,
  InputException,
  isIdLike,
  mapFromList,
  NotFoundException,
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
    private readonly repo: ProductProgressRepository,
  ) {}

  async getAvailableVariantsForProduct(product: Product, session: Session) {
    return Progress.Variants.filter((variant) => {
      const privileges = this.privilegesFor(
        session,
        withVariant(product, variant),
      );
      return privileges.can('read', 'completed');
    });
  }

  async readAllForManyReports(
    reports: readonly ProgressVariantByReportInput[],
    session: Session,
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
        details: row.progressList.flatMap((progress) => {
          const privileges = this.privilegesFor(session, report);
          return this.secure(progress, privileges) ?? [];
        }),
      };
    });
  }

  async readAllForManyProducts(
    products: readonly ProgressVariantByProductInput[],
    session: Session,
  ): Promise<readonly ProgressVariantByProductOutput[]> {
    if (products.length === 0) {
      return [];
    }
    const productMap = mapFromList(products, (p) => [p.product.id, p.product]);
    const rows = await this.repo.readAllProgressReportsForManyProducts(
      products,
    );
    return rows.map((row): ProgressVariantByProductOutput => {
      const product = productMap[row.productId];
      return {
        product,
        variant: Progress.Variants.byKey(row.variant),
        details: row.progressList.flatMap((progress) => {
          const privileges = this.privilegesFor(session, product);
          return this.secure(progress, privileges) ?? [];
        }),
      };
    });
  }

  async readOne(
    report: ID | ProgressReport,
    product: ID | Product,
    variant: Variant<ProgressVariant>,
    session: Session,
  ): Promise<ProductProgress> {
    const productId = isIdLike(product) ? product : product.id;
    const reportId = isIdLike(report) ? report : report.id;
    const context = !isIdLike(product)
      ? product
      : !isIdLike(report)
      ? report
      : await this.repo.getScope(productId, session);

    const unsecured = await this.repo.readOne(productId, reportId, variant);
    const progress = this.secure(
      unsecured,
      this.privilegesFor(session, context),
    );
    if (!progress) {
      throw new NotFoundException();
    }
    return progress;
  }

  async readOneForCurrentReport(
    input: ProgressVariantByProductInput,
    session: Session,
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
      withVariant(scope, input.variant),
    );
    if (!privileges.can('read') || !privileges.can('edit', 'completed')) {
      throw new UnauthorizedException(
        `You do not have the permission to update the "${input.variant.label}" variant of this goal's progress`,
      );
    }

    input.steps.forEach((step, index) => {
      if (!scope.steps.includes(step.step)) {
        throw new StepNotPlannedException(input.productId, step.step, index);
      }
      if (step.completed && step.completed > scope.progressTarget) {
        throw new InputException(
          "Completed value cannot exceed product's progress target",
          `steps.${index}.completed`,
        );
      }
    });

    const progress = await this.repo.update(input);
    return this.secure(progress, this.privilegesFor(session, scope))!;
  }

  private secure(
    progress: UnsecuredProductProgress,
    privileges: UserResourcePrivileges<typeof StepProgress>,
  ): ProductProgress | undefined {
    const vp = privileges.forContext(
      withVariant(privileges.context!, progress.variant),
    );
    if (!vp.can('read')) {
      return undefined;
    }
    return {
      ...progress,
      variant: Progress.Variants.byKey(progress.variant),
      steps: progress.steps.map((step) => vp.secure(step)),
    };
  }

  private privilegesFor(
    session: Session,
    context: HasSensitivity & HasScope,
  ): UserResourcePrivileges<typeof StepProgress> {
    return this.privileges.for(session, StepProgress, context as any);
  }
}
