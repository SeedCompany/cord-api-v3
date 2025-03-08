import { Injectable } from '@nestjs/common';
import { many, Many } from '@seedcompany/common';
import { e, Gel } from '~/core/gel';
import { ProjectType } from '../dto';
import { FinancialApproverInput } from './dto';

@Injectable()
export class FinancialApproverRepository {
  constructor(private readonly db: Gel) {}

  async read(types?: Many<ProjectType>) {
    const query = e.select(e.Project.FinancialApprover, (approver) => ({
      projectTypes: true,
      user: () => ({ id: true, email: true }),
      ...(types
        ? {
            filter: e.op(
              'exists',
              e.op(
                approver.projectTypes,
                'intersect',
                e.cast(e.Project.Type, e.set(...many(types))),
              ),
            ),
          }
        : {}),
    }));
    return await this.db.run(query);
  }

  async write({ user: userId, projectTypes }: FinancialApproverInput) {
    const user = e.cast(e.User, e.cast(e.uuid, userId));

    if (projectTypes.length === 0) {
      const query = e.delete(e.Project.FinancialApprover, (fa) => ({
        filter: e.op(fa.user, '=', user),
      }));
      await this.db.run(query);
      return null;
    }

    const written = e
      .insert(e.Project.FinancialApprover, { user, projectTypes })
      .unlessConflict(({ user }) => ({
        on: user,
        else: e.update(e.Project.FinancialApprover, (approver) => ({
          filter_single: e.op(approver.user, '=', user),
          set: { projectTypes },
        })),
      }));
    const query = e.select(written, () => ({
      projectTypes: true,
      user: () => ({ id: true, email: true }),
    }));
    return await this.db.run(query);
  }
}
