import { Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, isNull, lt } from 'drizzle-orm';
import { DateTime } from 'luxon';
import {
  CalendarDate,
  generateId,
  type ID,
  NotFoundException,
  type UnsecuredDto,
  type Variant,
} from '~/common';
import { Identity } from '~/core/authentication';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import {
  engagements,
  periodicReports,
  productProgress,
  products,
  projects,
  stepProgress,
} from '~/core/drizzle/schema';
import { type ScopedRole } from '../authorization/dto/role.dto';
import { type ProductStep } from '../product/dto';
import { requesterScopeByProject } from '../project/project-member/membership-scope';
import {
  type ProgressVariantByProductInput,
  type ProgressVariantByReportInput,
  type StepProgress as StepProgressDto,
  type UnsecuredProductProgress,
  type UpdateProductProgress,
} from './dto';

type ProgressRow = typeof productProgress.$inferSelect & {
  steps: Array<typeof stepProgress.$inferSelect>;
};

@Injectable()
export class ProductProgressDrizzleRepository {
  constructor(
    private readonly drizzle: DrizzleService,
    private readonly identity: Identity,
  ) {}

  protected get db() {
    return this.drizzle.client;
  }

  async readOne(
    productId: ID,
    reportId: ID,
    variant: Variant,
  ): Promise<UnsecuredProductProgress> {
    const product = await this.getProduct(productId);
    if (!product) {
      throw new NotFoundException(
        'Could not find progress for product and report period',
      );
    }
    const rows = await this.progressRows([productId], [reportId], variant.key);
    return this.toDto(product.steps, productId, reportId, variant.key, rows[0]);
  }

  async readOneForCurrentReport(input: ProgressVariantByProductInput) {
    const product = await this.getProduct(input.product.id);
    if (!product) return undefined;
    const [report] = await this.db
      .select({ id: periodicReports.id })
      .from(periodicReports)
      .where(
        and(
          eq(periodicReports.engagementId, product.engagementId),
          eq(periodicReports.type, 'Progress'),
          lt(periodicReports.end, CalendarDate.local().toISODate()),
        ),
      )
      .orderBy(desc(periodicReports.end), asc(periodicReports.start))
      .limit(1);
    if (!report) return undefined;
    return await this.readOne(input.product.id, report.id, input.variant);
  }

  async readAllProgressReportsForManyProducts(
    inputs: readonly ProgressVariantByProductInput[],
  ) {
    const results = [];
    for (const input of inputs) {
      const product = await this.getProduct(input.product.id);
      if (!product) continue;
      const reports = await this.db
        .select({ id: periodicReports.id })
        .from(periodicReports)
        .where(
          and(
            eq(periodicReports.engagementId, product.engagementId),
            eq(periodicReports.type, 'Progress'),
          ),
        );
      const progressRows = await this.progressRows(
        [input.product.id],
        reports.map((r) => r.id),
        input.variant.key,
      );
      const byReport = new Map(progressRows.map((row) => [row.reportId, row]));
      results.push({
        productId: input.product.id,
        variant: input.variant.key,
        progressList: reports.map((report) =>
          this.toDto(
            product.steps,
            input.product.id,
            report.id,
            input.variant.key,
            byReport.get(report.id),
          ),
        ),
      });
    }
    return results;
  }

  async readAllProgressReportsForManyReports(
    inputs: readonly ProgressVariantByReportInput[],
  ) {
    const results = [];
    for (const input of inputs) {
      const [report] = await this.db
        .select({
          id: periodicReports.id,
          engagementId: periodicReports.engagementId,
        })
        .from(periodicReports)
        .where(eq(periodicReports.id, input.report.id));
      if (!report?.engagementId) continue;
      const engagementProducts = await this.db
        .select({ id: products.id, steps: products.steps })
        .from(products)
        .where(
          and(
            eq(products.engagementId, report.engagementId),
            isNull(products.deletedAt),
          ),
        );
      const progressRows = await this.progressRows(
        engagementProducts.map((p) => p.id),
        [report.id],
        input.variant.key,
      );
      const byProduct = new Map(
        progressRows.map((row) => [row.productId, row]),
      );
      results.push({
        reportId: report.id,
        variant: input.variant.key,
        progressList: engagementProducts.map((product) =>
          this.toDto(
            product.steps,
            product.id,
            report.id,
            input.variant.key,
            byProduct.get(product.id),
          ),
        ),
      });
    }
    return results;
  }

  async update(input: UpdateProductProgress) {
    const product = await this.getProduct(input.product);
    const [report] = await this.db
      .select({ id: periodicReports.id })
      .from(periodicReports)
      .where(eq(periodicReports.id, input.report));
    if (!product || !report) {
      throw new NotFoundException(
        'Could not find product or report to add progress to',
      );
    }
    await this.db
      .insert(productProgress)
      .values({
        id: await generateId(),
        productId: input.product,
        reportId: input.report,
        variant: input.variant.key,
      })
      .onConflictDoNothing();
    const [row] = await this.db
      .select({ id: productProgress.id })
      .from(productProgress)
      .where(
        and(
          eq(productProgress.productId, input.product),
          eq(productProgress.reportId, input.report),
          eq(productProgress.variant, input.variant.key),
        ),
      );
    for (const step of input.steps) {
      await this.db
        .insert(stepProgress)
        .values({
          id: await generateId(),
          progressId: row!.id,
          step: step.step,
          completed: step.completed,
        })
        .onConflictDoUpdate({
          target: [stepProgress.progressId, stepProgress.step],
          set: { completed: step.completed, updatedAt: new Date() },
        });
    }
    return await this.readOne(input.product, input.report, input.variant);
  }

  async getScope(productId: ID): Promise<{
    sensitivity: string;
    scope: ScopedRole[];
    progressTarget: number;
    steps: readonly ProductStep[];
  }> {
    const [row] = await this.db
      .select({
        progressTarget: products.progressTarget,
        steps: products.steps,
        projectId: projects.id,
        sensitivity: projects.sensitivity,
      })
      .from(products)
      .innerJoin(engagements, eq(products.engagementId, engagements.id))
      .innerJoin(projects, eq(engagements.projectId, projects.id))
      .where(and(eq(products.id, productId), isNull(products.deletedAt)));
    if (!row) {
      throw new NotFoundException('Could not find product');
    }
    const scopeByProject = await requesterScopeByProject(
      this.db,
      this.identity.current.userId,
      [row.projectId],
    );
    return {
      sensitivity: row.sensitivity,
      scope: scopeByProject.get(row.projectId) ?? [],
      progressTarget: row.progressTarget,
      steps: row.steps,
    };
  }

  private async getProduct(productId: ID) {
    const [product] = await this.db
      .select({
        id: products.id,
        engagementId: products.engagementId,
        steps: products.steps,
        progressTarget: products.progressTarget,
      })
      .from(products)
      .where(and(eq(products.id, productId), isNull(products.deletedAt)));
    return product;
  }

  private async progressRows(
    productIds: readonly ID[],
    reportIds: readonly ID[],
    variantKey: string,
  ): Promise<ProgressRow[]> {
    if (productIds.length === 0 || reportIds.length === 0) return [];
    const rows = await this.db.query.productProgress.findMany({
      where: (pp) =>
        and(
          inArray(pp.productId, [...productIds] as Array<ID<'Product'>>),
          inArray(pp.reportId, [...reportIds]),
          eq(pp.variant, variantKey),
        ),
      with: { steps: true },
    });
    return rows as ProgressRow[];
  }

  private toDto(
    declaredSteps: readonly ProductStep[],
    productId: ID,
    reportId: ID,
    variant: string,
    row?: ProgressRow,
  ): UnsecuredProductProgress {
    const byStep = new Map(row?.steps.map((s) => [s.step, s]) ?? []);
    const dto: unknown = {
      ...(row && {
        id: row.id,
        createdAt: DateTime.fromJSDate(row.createdAt),
      }),
      productId,
      reportId,
      variant,
      steps: declaredSteps.map((step): UnsecuredDto<StepProgressDto> => {
        const sp = byStep.get(step);
        return sp
          ? {
              id: sp.id,
              createdAt: DateTime.fromJSDate(sp.createdAt),
              step,
              completed: sp.completed,
            }
          : { step, completed: null };
      }),
    };
    return dto as UnsecuredProductProgress;
  }
}
