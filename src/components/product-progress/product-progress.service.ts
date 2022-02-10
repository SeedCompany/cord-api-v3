import { Injectable } from '@nestjs/common';
import { difference } from 'lodash';
import {
  asyncPool,
  ID,
  InputException,
  isIdLike,
  mapFromList,
  Sensitivity,
  Session,
  UnauthorizedException,
} from '../../common';
import { addScope } from '../../common/session';
import { AuthorizationService } from '../authorization/authorization.service';
import { ProgressReport } from '../periodic-report';
import { Product } from '../product';
import {
  ProductProgress,
  ProductProgressInput,
  StepProgress,
  UnsecuredProductProgress,
} from './dto';
import { ProductProgressRepository } from './product-progress.repository';

@Injectable()
export class ProductProgressService {
  constructor(
    private readonly auth: AuthorizationService,
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
    return await asyncPool(
      5,
      progressForManyReports,
      async ({ reportId, progressList }) => {
        const report = reportMap[reportId];
        const progress = await asyncPool(5, progressList, (progress) =>
          this.secure(
            progress,
            addScope(session, report.scope),
            report.sensitivity
          )
        );
        return { report, progress };
      }
    );
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
    return await asyncPool(
      5,
      progressForManyProducts,
      async ({ productId, progressList }) => {
        const product = productMap[productId];
        const progress = await asyncPool(5, progressList, (progress) =>
          this.secure(
            progress,
            addScope(session, product.scope),
            product.sensitivity
          )
        );
        return { product, progress };
      }
    );
  }

  async readOne(
    report: ID | ProgressReport,
    product: ID | Product,
    session: Session
  ): Promise<ProductProgress> {
    const productId = isIdLike(product) ? product : product.id;
    const reportId = isIdLike(report) ? report : report.id;
    const { scope, sensitivity } = !isIdLike(product)
      ? product
      : !isIdLike(report)
      ? report
      : await this.repo.getScope(productId, session);

    const progress = await this.repo.readOne(productId, reportId);
    return await this.secure(progress, addScope(session, scope), sensitivity);
  }

  async readOneForCurrentReport(
    product: Product,
    session: Session
  ): Promise<ProductProgress | undefined> {
    const progress = await this.repo.readOneForCurrentReport(product.id);
    return progress
      ? await this.secure(
          progress,
          addScope(session, product.scope),
          product.sensitivity
        )
      : undefined;
  }

  async update(input: ProductProgressInput, session: Session) {
    const scope = await this.repo.getScope(input.productId, session);
    const perms = await this.auth.getPermissions({
      resource: StepProgress,
      sensitivity: scope.sensitivity,
      otherRoles: scope.scope,
      sessionOrUserId: session,
    });
    if (!perms.completed.canEdit) {
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
      if (difference([step.step], scope.steps).length > 0) {
        throw new InputException('Step is not planned', `steps.${index}.step`);
      }
      if (step.completed && step.completed > scope.progressTarget) {
        throw new InputException(
          "Completed value cannot exceed product's progress target",
          `steps.${index}.completed`
        );
      }
    });

    const progress = await this.repo.update(cleanedInput);
    return await this.secure(
      progress,
      addScope(session, scope.scope),
      scope.sensitivity
    );
  }

  async secureAll(
    progress: readonly UnsecuredProductProgress[],
    session: Session,
    sensitivity: Sensitivity
  ): Promise<readonly ProductProgress[]> {
    return await Promise.all(
      progress.map((p) => this.secure(p, session, sensitivity))
    );
  }

  async secure(
    progress: UnsecuredProductProgress,
    session: Session,
    sensitivity: Sensitivity
  ): Promise<ProductProgress> {
    const steps = await Promise.all(
      progress.steps.map(async (step): Promise<StepProgress> => {
        const secured = await this.auth.secureProperties(
          StepProgress,
          step,
          session,
          [],
          sensitivity
        );
        return {
          ...step,
          ...secured,
        };
      })
    );
    return {
      ...progress,
      steps,
    };
  }
}
