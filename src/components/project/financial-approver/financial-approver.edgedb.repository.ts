import { Injectable } from '@nestjs/common';
import { ID, PublicOf } from '~/common';
import { e, RepoFor } from '~/core/edgedb';
import { ProjectType } from '../dto';
import {
  ProjectTypeFinancialApprover,
  ProjectTypeFinancialApproverInput,
} from './financial-approver.dto';
import { FinancialApproverRepository } from './financial-approver.repository';

@Injectable()
export class FinancialApproverEdgeDBRepository
  extends RepoFor(ProjectTypeFinancialApprover, {
    hydrate: (thing) => ({
      ...thing['*'],
      user: true,
    }),
  }).customize((cls) => {
    return class extends cls {
      async read(projectType: ProjectType) {
        const query = e.select(e.Project.FinancialApprover, (fa) => ({
          ...this.hydrate(fa),
          filter: e.op(
            e.cast(e.Project.Type, projectType),
            'in',
            fa.projectTypes,
          ),
        }));

        return await this.db.run(query);
      }

      async update(input: ProjectTypeFinancialApproverInput) {
        // if input.projectTypes is empty, delete the record for the user
        // find the financial approver based on the user
        const faQuery = this.selectByUserQuery(input.user);
        const fa = await this.db.run(faQuery);

        if (input.projectTypes.length === 0 && !!fa) {
          const query = this.deleteQuery(fa.user.id);
          await this.db.run(query);
          return null;
        }

        if (input.projectTypes.length > 0) {
          const upsertQuery = this.upsertQuery(input.user, input.projectTypes);
          const upserted = await this.db.run(upsertQuery);

          if (upserted) {
            const findQuery = this.selectByIdQuery(upserted.id);
            return await this.db.run(findQuery);
          }

          return null;
        }

        return null;
      }

      private selectByIdQuery(objId: ID) {
        const id = e.cast(e.uuid, objId);

        return e.select(e.Project.FinancialApprover, (fa) => ({
          ...this.hydrate(fa),
          filter_single: { id },
        }));
      }

      private upsertQuery(userId: ID, projectTypes: readonly ProjectType[]) {
        const user = e.cast(e.User, e.cast(e.uuid, userId));
        const castedTypes = projectTypes as typeof e.Project.Type.__values__;

        return e
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
          }));
      }

      private selectByUserQuery(userId: ID) {
        const user = e.cast(e.User, e.cast(e.uuid, userId));

        return e.select(e.Project.FinancialApprover, (fa) => ({
          ...this.hydrate(fa),
          filter_single: e.op(fa.user, '=', user),
        }));
      }

      private deleteQuery(userId: ID) {
        const user = e.cast(e.User, e.cast(e.uuid, userId));

        return e.delete(e.Project.FinancialApprover, (fa) => ({
          filter: e.op(fa.user, '=', user),
        }));
      }
    };
  })
  implements PublicOf<FinancialApproverRepository> {}
