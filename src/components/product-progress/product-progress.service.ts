import { Injectable } from '@nestjs/common';
import {
  ID,
  InputException,
  isIdLike,
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

  async readAllByReport(
    report: ProgressReport,
    session: Session
  ): Promise<readonly ProductProgress[]> {
    const progress = await this.repo.readAllProgressReportsByReport(report.id);
    return await this.secureAll(progress, addScope(session, report.scope));
  }

  async readAllByProduct(
    product: Product,
    session: Session
  ): Promise<readonly ProductProgress[]> {
    const progress = await this.repo.readAllProgressReportsByProduct(
      product.id
    );
    return await this.secureAll(progress, addScope(session, product.scope));
  }

  async readOne(
    report: ID | ProgressReport,
    product: ID | Product,
    session: Session
  ): Promise<ProductProgress> {
    const productId = isIdLike(product) ? product : product.id;
    const reportId = isIdLike(report) ? report : report.id;
    const scope = !isIdLike(product)
      ? product.scope!
      : !isIdLike(report)
      ? report.scope
      : (await this.repo.getScope(productId, session)).scopedRoles;

    const progress = await this.repo.readOne(productId, reportId);
    return await this.secure(progress, addScope(session, scope));
  }

  async readOneForCurrentReport(
    product: Product,
    session: Session
  ): Promise<ProductProgress | undefined> {
    const progress = await this.repo.readOneForCurrentReport(product.id);
    return progress
      ? await this.secure(progress, addScope(session, product.scope))
      : undefined;
  }

  async update(input: ProductProgressInput, session: Session) {
    const scope = await this.repo.getScope(input.productId, session);
    const perms = await this.auth.getPermissions({
      resource: StepProgress,
      sensitivity: scope.sensitivity,
      otherRoles: scope.scopedRoles,
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
      if (step.completed && step.completed > scope.progressTarget) {
        throw new InputException(
          "Completed value cannot exceed product's progress target",
          `steps.${index}.completed`
        );
      }
    });

    const progress = await this.repo.update(cleanedInput);
    return await this.secure(progress, session);
  }

  async secureAll(
    progress: readonly UnsecuredProductProgress[],
    session: Session
  ): Promise<readonly ProductProgress[]> {
    return await Promise.all(progress.map((p) => this.secure(p, session)));
  }

  async secure(
    progress: UnsecuredProductProgress,
    session: Session
  ): Promise<ProductProgress> {
    const steps = await Promise.all(
      progress.steps.map(async (step): Promise<StepProgress> => {
        const secured = await this.auth.secureProperties(
          StepProgress,
          step,
          session
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
