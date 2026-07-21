import { and, eq, isNull } from 'drizzle-orm';
import { DateTime } from 'luxon';
import { type ID } from '~/common';
import { type BaseNode } from '~/core/neo4j/results';
import { type DrizzleDb } from './drizzle.service';
import {
  engagements,
  languages,
  partners,
  periodicReports,
  projects,
  users,
} from './schema';

/**
 * Resolve an arbitrary resource id to a Neo4j-shaped {@link BaseNode} by
 * probing the candidate parent tables. Polymorphic-parent domains (Comments,
 * Post) hand the service this node so `ResourceLoader.loadByBaseNode` can
 * resolve the concrete type from `labels` and load the full DTO — the same job
 * the Neo4j `DtoRepository.getBaseNode(id)` did against the single graph.
 *
 * Covers the union of Commentable + Postable parents that are migrated:
 * User, Language, Partner, Project, Engagement, ProgressReport. The caller's
 * `verifyImplements(parent, Commentable|Postable)` rejects any match that isn't
 * valid for its domain (e.g. a User parent for a Post).
 *
 * migration-todo: delete at Phase 7 cutover with the rest of the Neo4j/BaseNode
 * compatibility shims.
 */
export const resolveResourceBaseNode = async (
  db: DrizzleDb,
  id: ID,
): Promise<BaseNode | undefined> => {
  const mk = (labels: string[], createdAt: Date): BaseNode => ({
    identity: id,
    labels: [...labels, 'BaseNode'],
    properties: { id, createdAt: DateTime.fromJSDate(createdAt) },
  });

  const [user, language, partner, project, engagement, progressReport] =
    await Promise.all([
      db
        .select({ createdAt: users.createdAt })
        .from(users)
        .where(and(eq(users.id, id as ID<'User'>), isNull(users.deletedAt)))
        .limit(1),
      db
        .select({ createdAt: languages.createdAt })
        .from(languages)
        .where(
          and(
            eq(languages.id, id as ID<'Language'>),
            isNull(languages.deletedAt),
          ),
        )
        .limit(1),
      db
        .select({ createdAt: partners.createdAt })
        .from(partners)
        .where(
          and(eq(partners.id, id as ID<'Partner'>), isNull(partners.deletedAt)),
        )
        .limit(1),
      db
        .select({ createdAt: projects.createdAt, type: projects.type })
        .from(projects)
        .where(
          and(eq(projects.id, id as ID<'Project'>), isNull(projects.deletedAt)),
        )
        .limit(1),
      db
        .select({ createdAt: engagements.createdAt, type: engagements.type })
        .from(engagements)
        .where(
          and(
            eq(engagements.id, id as ID<'Engagement'>),
            isNull(engagements.deletedAt),
          ),
        )
        .limit(1),
      // ProgressReport is a periodic_reports row (type='Progress'); it's
      // Commentable. periodic_reports has no deleted_at (real-delete design).
      db
        .select({ createdAt: periodicReports.createdAt })
        .from(periodicReports)
        .where(
          and(eq(periodicReports.id, id), eq(periodicReports.type, 'Progress')),
        )
        .limit(1),
    ]);

  if (user[0]) return mk(['User'], user[0].createdAt);
  if (language[0]) return mk(['Language'], language[0].createdAt);
  if (partner[0]) return mk(['Partner'], partner[0].createdAt);
  if (project[0])
    return mk([`${project[0].type}Project`, 'Project'], project[0].createdAt);
  if (engagement[0])
    return mk(
      [`${engagement[0].type}Engagement`, 'Engagement'],
      engagement[0].createdAt,
    );
  if (progressReport[0])
    return mk(['ProgressReport'], progressReport[0].createdAt);
  return undefined;
};
