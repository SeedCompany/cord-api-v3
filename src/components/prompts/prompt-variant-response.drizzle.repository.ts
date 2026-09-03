import { Inject } from '@nestjs/common';
import { and, asc, eq, isNull } from 'drizzle-orm';
import { LazyGetter as Once } from 'lazy-get-decorator';
import { DateTime } from 'luxon';
import {
  EnhancedResource,
  generateId,
  type ID,
  NotFoundException,
  type PaginatedListType,
  type ResourceShape,
  type UnsecuredDto,
  type VariantList,
  type VariantOf,
} from '~/common';
import { Identity } from '~/core/authentication';
import { DrizzleService } from '~/core/drizzle/drizzle.service';
import {
  promptVariantResponseEntries,
  promptVariantResponses,
} from '~/core/drizzle/schema';
import { LiveQueryStore } from '~/core/live-query';
import { defaultPermanentAfter } from '~/core/neo4j/query/properties/update-property';
import { type BaseNode } from '~/core/neo4j/results';
import { type EdgePrivileges, Privileges } from '../authorization';
import { type ChildListAction } from '../authorization/policy/actions';
import {
  type ChangePrompt,
  type ChoosePrompt,
  type PromptVariantResponse,
  type UpdatePromptVariantResponse,
} from './dto';
import { type ListEdge } from './prompt-variant-response.repository';

type ResponseRow = typeof promptVariantResponses.$inferSelect & {
  entries: Array<typeof promptVariantResponseEntries.$inferSelect>;
};

/**
 * Drizzle mirror of {@link import('./prompt-variant-response.repository').PromptVariantResponseRepository}.
 * All subtypes share the prompt_variant_responses/_entries table pair,
 * scoped by `resource_type`.
 */
export const PromptVariantResponseDrizzleRepository = <
  Parent extends ResourceShape<any>,
  TResourceStatic extends ResourceShape<PromptVariantResponse<TVariant>> & {
    Variants: VariantList<TVariant>;
  },
  TVariant extends string = VariantOf<TResourceStatic>,
>(
  parentEdge: ListEdge<Parent>,
  resource: TResourceStatic,
) => {
  abstract class PromptVariantResponseDrizzleRepositoryClass {
    readonly resource = EnhancedResource.of(resource);

    @Inject(Privileges)
    protected readonly privilegesService: Privileges;
    @Inject(Identity)
    protected readonly identity: Identity;
    @Inject(DrizzleService)
    protected readonly drizzle: DrizzleService;
    @Inject(LiveQueryStore)
    protected readonly liveQueryStore: LiveQueryStore;

    protected get db() {
      return this.drizzle.client;
    }

    @Once()
    get edge() {
      return this.privilegesService.forEdge(
        ...(parentEdge as [any, any]),
      ) as EdgePrivileges<Parent, any, ChildListAction>;
    }

    // migration-todo: the Neo4j hydrate applies filterToReadable() row-level;
    // this port (and readOne below) deliberately relies on the service's
    // parent-edge `edge.can('read')` gate instead — equivalent today because
    // PVR read grants are resource-level, not per-row. If a per-row condition
    // (e.g. creator-based) is ever added, port an EXISTS predicate mirroring
    // oncePerProjectFromProgressReportChild here.
    async list(
      parentId: ID,
    ): Promise<
      PaginatedListType<UnsecuredDto<PromptVariantResponse<TVariant>>>
    > {
      const rows = await this.db.query.promptVariantResponses.findMany({
        where: (r) =>
          and(
            eq(r.parentId, parentId),
            eq(r.resourceType, resource.name),
            isNull(r.deletedAt),
          ),
        with: { entries: true },
        orderBy: (r) => [asc(r.createdAt), asc(r.id)],
        // Mirror the Neo4j repo's paginate({ count: 25, page: 1 }): cap the
        // page and probe one extra row for hasMore rather than returning every
        // row (which also bounds the payload).
        limit: 26,
      });
      const hasMore = rows.length > 25;
      const items = rows
        .slice(0, 25)
        .map((row) => this.toDto(row as ResponseRow));
      return { items, total: items.length, hasMore };
    }

    async readOne(
      id: ID,
    ): Promise<UnsecuredDto<PromptVariantResponse<TVariant>>> {
      const row = await this.db.query.promptVariantResponses.findFirst({
        where: (r) =>
          and(
            eq(r.id, id),
            eq(r.resourceType, resource.name),
            isNull(r.deletedAt),
          ),
        with: { entries: true },
      });
      if (!row) {
        throw new NotFoundException(`Could not find ${resource.name}`);
      }
      return this.toDto(row as ResponseRow);
    }

    async create(
      input: ChoosePrompt,
    ): Promise<UnsecuredDto<PromptVariantResponse<TVariant>>> {
      const id = await generateId();
      await this.db.insert(promptVariantResponses).values({
        id,
        resourceType: resource.name,
        parentId: input.resource,
        prompt: input.prompt,
        creatorId: this.identity.current.userId,
      });
      return await this.readOne(id);
    }

    // migration-todo: this read-then-write is not serialized. Two concurrent
    // submits for the same (response_id, variant) can both see no active entry
    // (or both retire the same one) and then race into the partial unique
    // index — the loser fails with a unique-violation (no bad data lands; the
    // index is the fail-safe). The Neo4j path is atomic in a single query.
    // Deferred: serialize with a tx + `SELECT ... FOR UPDATE` on the parent
    // response, or a conflict-aware upsert. Low-priority given the backstop and
    // the rarity of concurrent same-variant submits.
    async submitResponse(input: UpdatePromptVariantResponse<TVariant>) {
      const now = new Date();
      const [entry] = await this.db
        .select()
        .from(promptVariantResponseEntries)
        .where(
          and(
            eq(promptVariantResponseEntries.responseId, input.id),
            eq(promptVariantResponseEntries.variant, input.variant),
            isNull(promptVariantResponseEntries.deletedAt),
          ),
        );
      const permanentCutoff = DateTime.now().minus(defaultPermanentAfter);
      const isPermanent =
        entry && DateTime.fromJSDate(entry.createdAt) <= permanentCutoff;
      if (entry && !isPermanent) {
        // Still within the edit window — overwrite in place.
        await this.db
          .update(promptVariantResponseEntries)
          .set({ response: input.response, modifiedAt: now })
          .where(eq(promptVariantResponseEntries.id, entry.id));
      } else {
        if (entry) {
          // Past the window — retire the old entry, keeping history.
          await this.db
            .update(promptVariantResponseEntries)
            .set({ deletedAt: now })
            .where(eq(promptVariantResponseEntries.id, entry.id));
        }
        await this.db.insert(promptVariantResponseEntries).values({
          responseId: input.id,
          variant: input.variant,
          response: input.response,
          creatorId: this.identity.current.userId,
        });
      }
      await this.db
        .update(promptVariantResponses)
        .set({ modifiedAt: now, updatedAt: now })
        .where(eq(promptVariantResponses.id, input.id));
    }

    async changePrompt(input: ChangePrompt) {
      const now = new Date();
      await this.db
        .update(promptVariantResponses)
        .set({ prompt: input.prompt, modifiedAt: now, updatedAt: now })
        .where(eq(promptVariantResponses.id, input.id));
    }

    async delete(id: ID) {
      // Mirrors the Neo4j arm, whose `this.deleteNode(id)` invalidates via the
      // shared base with `this.resource`. `submitResponse`/`changePrompt` are
      // deliberately NOT invalidated here: their Neo4j counterparts use raw
      // Cypher with no invalidation either, so leaving them alone is parity.
      this.liveQueryStore.invalidate([this.resource, id]);
      await this.db
        .update(promptVariantResponses)
        .set({ deletedAt: new Date() })
        .where(eq(promptVariantResponses.id, id));
    }

    protected toDto(
      row: ResponseRow,
    ): UnsecuredDto<PromptVariantResponse<TVariant>> {
      // Neo4j-shaped BaseNode so ResourceLoader.loadByBaseNode() keeps
      // working for the parent field / privilege context — only labels +
      // properties.id are read (createdAt is along for type shape).
      const parentResource = EnhancedResource.of(parentEdge[0] as any);
      const parent: BaseNode = {
        identity: row.parentId,
        labels: [parentResource.name, 'BaseNode'],
        properties: {
          id: row.parentId,
          createdAt: DateTime.fromJSDate(row.createdAt),
        },
      };
      // `canDelete` is intersected in because `UnsecuredDto` deliberately drops
      // it — the policy layer in the service decides it.
      const dto: UnsecuredDto<PromptVariantResponse<TVariant>> & {
        canDelete: boolean;
      } = {
        id: row.id,
        createdAt: DateTime.fromJSDate(row.createdAt),
        modifiedAt: DateTime.fromJSDate(row.modifiedAt),
        creator: { id: row.creatorId },
        parent,
        prompt: row.prompt,
        responses: row.entries
          .filter((entry) => !entry.deletedAt)
          .map((entry) => ({
            // The column is plain text; which variants are valid depends on the
            // subtype this repository was built for, which isn't knowable here.
            // Narrowed deliberately, and only for this field.
            variant: entry.variant as TVariant,
            response: entry.response,
            creator: { id: entry.creatorId },
            modifiedAt: DateTime.fromJSDate(
              entry.modifiedAt ?? entry.createdAt,
            ),
          })),
        canDelete: true,
      };
      return dto;
    }
  }

  return PromptVariantResponseDrizzleRepositoryClass;
};
