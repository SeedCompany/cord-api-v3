import { Injectable } from '@nestjs/common';
import { mapEntries } from '@seedcompany/common';
import {
  type ID,
  InputException,
  isIdLike,
  NotFoundException,
  UnauthorizedException,
  type Variant,
} from '~/common';
import { LiveQueryStore } from '~/core/live-query';
import {
  type HasScope,
  type HasSensitivity,
  Privileges,
  type UserResourcePrivileges,
  withVariant,
} from '../authorization';
import { type Product } from '../product/dto';
import type { ProgressReport } from '../progress-report/dto';
import {
  type ProductProgress,
  type ProgressVariantByProductInput,
  type ProgressVariantByProductOutput,
  type ProgressVariantByReportInput,
  type ProgressVariantByReportOutput,
  StepProgress,
  type UnsecuredProductProgress,
  type UpdateProductProgress,
} from './dto';
import {
  ProgressReportVariantProgress as Progress,
  type ProgressVariant,
} from './dto/variant-progress.dto';
import { ProductProgressRepository } from './product-progress.repository';
import { StepNotPlannedException } from './step-not-planned.exception';

@Injectable()
export class ProductProgressService {
  constructor(
    private readonly privileges: Privileges,
    private readonly liveQueryStore: LiveQueryStore,
    private readonly repo: ProductProgressRepository,
  ) {}

  async getAvailableVariantsForProduct(product: Product) {
    return Progress.Variants.filter((variant) => {
      const privileges = this.privilegesFor(withVariant(product, variant));
      return privileges.can('read', 'completed');
    });
  }

  async readAllForManyReports(
    reports: readonly ProgressVariantByReportInput[],
  ): Promise<readonly ProgressVariantByReportOutput[]> {
    if (reports.length === 0) {
      return [];
    }
    const reportMap = mapEntries(reports, ({ report }) => [
      report.id,
      report,
    ]).asRecord;
    const rows = await this.repo.readAllProgressReportsForManyReports(reports);
    return rows.map((row): ProgressVariantByReportOutput => {
      const report = reportMap[row.reportId]!;
      return {
        report,
        variant: Progress.Variants.byKey(row.variant),
        details: row.progressList.flatMap((progress) => {
          const privileges = this.privilegesFor(report);
          return this.secure(progress, privileges) ?? [];
        }),
      };
    });
  }

  async readAllForManyProducts(
    products: readonly ProgressVariantByProductInput[],
  ): Promise<readonly ProgressVariantByProductOutput[]> {
    if (products.length === 0) {
      return [];
    }
    const productMap = mapEntries(products, ({ product }) => [
      product.id,
      product,
    ]).asRecord;
    const rows =
      await this.repo.readAllProgressReportsForManyProducts(products);
    return rows.map((row): ProgressVariantByProductOutput => {
      const product = productMap[row.productId]!;
      return {
        product,
        variant: Progress.Variants.byKey(row.variant),
        details: row.progressList.flatMap((progress) => {
          const privileges = this.privilegesFor(product);
          return this.secure(progress, privileges) ?? [];
        }),
      };
    });
  }

  async readOne(
    report: ID | ProgressReport,
    product: ID | Product,
    variant: Variant<ProgressVariant>,
  ): Promise<ProductProgress> {
    const productId = isIdLike(product) ? product : product.id;
    const reportId = isIdLike(report) ? report : report.id;
    const context = !isIdLike(product)
      ? product
      : !isIdLike(report)
        ? report
        : await this.repo.getScope(productId);

    const unsecured = await this.repo.readOne(productId, reportId, variant);
    const progress = this.secure(unsecured, this.privilegesFor(context));
    if (!progress) {
      throw new NotFoundException();
    }
    return progress;
  }

  async readOneForCurrentReport(
    input: ProgressVariantByProductInput,
  ): Promise<ProductProgress | undefined> {
    const progress = await this.repo.readOneForCurrentReport(input);
    if (!progress) {
      return undefined;
    }
    return this.secure(progress, this.privilegesFor(input.product));
  }

  async update(input: UpdateProductProgress) {
    const scope = await this.repo.getScope(input.product);
    const privileges = this.privilegesFor(withVariant(scope, input.variant));
    if (!privileges.can('read') || !privileges.can('edit', 'completed')) {
      throw new UnauthorizedException(
        `You do not have the permission to update the "${input.variant.label}" variant of this goal's progress`,
      );
    }

    const errors = input.steps.flatMap((step, index) => {
      if (!scope.steps.includes(step.step)) {
        return new StepNotPlannedException(input.product, step.step, index);
      }
      if (step.completed && step.completed > scope.progressTarget) {
        return new InputException(
          "Completed value cannot exceed product's progress target",
          `steps.${index}.completed`,
        );
      }
      return [];
    });
    if (errors.length > 0) {
      throw new AggregateError(errors, 'Invalid Progress Input');
    }

    const progress = await this.repo.update(input);

    this.liveQueryStore.invalidate(
      `ProductProgress:${input.product}:${input.report}:${input.variant.key}`,
    );

    return this.secure(progress, this.privilegesFor(scope))!;
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
    context: HasSensitivity & HasScope,
  ): UserResourcePrivileges<typeof StepProgress> {
    return this.privileges.for(StepProgress, context as any);
  }
}
