import { Injectable } from '@nestjs/common';
import { PublicOf } from '~/common';
import { e, RepoFor } from '~/core/edgedb';
import { ProjectTypeFinancialApprover } from './dto/project-type-financial-approver.dto';
import { SetProjectTypeFinancialApprover } from './dto/set-project-type-financial-approver.dto';
import { ProjectTypeFinancialApproverRepository } from './project-type-financial-approver.repository';

@Injectable()
export class ProjectTypeFinancialApproverEdgeDBRepository
  extends RepoFor(ProjectTypeFinancialApprover, {
    hydrate: (fa) => ({
      ...fa['*'],
      user: true,
    }),
  }).withDefaults()
  implements PublicOf<ProjectTypeFinancialApproverRepository>
{
  async setFinancialApprover(input: SetProjectTypeFinancialApprover) {
    // if input.projectTypes is empty, delete the record for the user
    // find the financial approver based on the user
    const user = e.cast(e.User, e.cast(e.uuid, input.user));

    if (input.projectTypes.length === 0) {
      const query = e.delete(e.Project.FinancialApprover, (fa) => ({
        filter: e.op(fa.user, '=', user),
      }));
      await this.db.run(query);
      return null;
    }

    const castedTypes = input.projectTypes as typeof e.Project.Type.__values__;

    const updated = e.select(
      e
        .insert(e.Project.FinancialApprover, {
          user,
          projectTypes: castedTypes,
        })
        .unlessConflict((identity) => ({
          on: identity.user,
          else: e.update(e.Project.FinancialApprover, (fa) => ({
            filter_single: e.op(fa.user, '=', user),
            set: {
              projectTypes: castedTypes,
            },
          })),
        })),
      this.hydrate,
    );
    return await this.db.run(updated);
  }
}
