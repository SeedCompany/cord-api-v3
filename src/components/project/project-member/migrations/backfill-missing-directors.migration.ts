import { ModuleRef } from '@nestjs/core';
import { node, type Query, relation } from 'cypher-query-builder';
import { type Role } from '~/common';
import { BaseMigration, Migration } from '~/core/database';
import { ACTIVE, variable } from '~/core/database/query';
import { projectFilters } from '../../project-filters.query';
import {
  projectMemberFilters,
  ProjectMemberRepository,
} from '../project-member.repository';

@Migration('2025-06-18T00:00:05')
export class BackfillMissingDirectorsMigration extends BaseMigration {
  constructor(private readonly moduleRef: ModuleRef) {
    super();
  }

  async up() {
    const members = this.moduleRef.get(ProjectMemberRepository, {
      strict: false,
    });
    // @ts-expect-error the method is private, but it is fine for this.
    const upsertMember = members.upsertMember.bind(members);

    const openProjectsMissingRole = (role: Role) => (query: Query) =>
      query
        // Open projects
        .match(node('node', 'Project'))
        .apply(
          projectFilters({
            status: ['Active', 'InDevelopment'],
          }),
        )
        .with('node as project')
        // Missing role
        .subQuery('project', (sub) =>
          sub
            .match([
              node('project'),
              relation('out', '', 'member', ACTIVE),
              node('node', 'ProjectMember'),
            ])
            .apply(
              projectMemberFilters({
                active: true,
                roles: [role],
              }),
            )
            .with('count(node) as members')
            .raw('WHERE members = 0')
            .return('true as filtered'),
        )
        .with('*');

    await this.db
      .query()
      .apply((q) => {
        q.params.addParam(this.version, 'now');
      })
      .apply(openProjectsMissingRole('RegionalDirector'))
      // Find its region director
      .match([
        node('project'),
        relation('out', '', 'fieldRegion', ACTIVE),
        node('', 'FieldRegion'),
        relation('out', '', 'director', ACTIVE),
        node('director', 'User'),
      ])
      .apply(await upsertMember(variable('director'), 'RegionalDirector'))
      .return('project.id as id')
      .executeAndLogStats();

    await this.db
      .query()
      .apply((q) => {
        q.params.addParam(this.version, 'now');
      })
      .apply(openProjectsMissingRole('FieldOperationsDirector'))
      // Find its zone director
      .match([
        node('project'),
        relation('out', '', 'fieldRegion', ACTIVE),
        node('', 'FieldRegion'),
        relation('out', '', 'zone', ACTIVE),
        node('', 'FieldZone'),
        relation('out', '', 'director', ACTIVE),
        node('director', 'User'),
      ])
      .apply(
        await upsertMember(variable('director'), 'FieldOperationsDirector'),
      )
      .return('project.id as id')
      .executeAndLogStats();
  }
}
