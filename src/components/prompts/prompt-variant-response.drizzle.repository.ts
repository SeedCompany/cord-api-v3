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
      });
      const items = rows.map((row) => this.toDto(row as ResponseRow));
      return { items, total: items.length, hasMore: false };
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
      const dto: unknown = {
        id: row.id,
        createdAt: DateTime.fromJSDate(row.createdAt),
        modifiedAt: DateTime.fromJSDate(row.modifiedAt),
        creator: { id: row.creatorId },
        parent,
        prompt: row.prompt,
        responses: row.entries
          .filter((e) => !e.deletedAt)
          .map((e) => ({
            variant: e.variant,
            response: e.response,
            creator: { id: e.creatorId },
            modifiedAt: DateTime.fromJSDate(e.modifiedAt ?? e.createdAt),
          })),
        canDelete: true,
      };
      return dto as UnsecuredDto<PromptVariantResponse<TVariant>>;
    }
  }

  return PromptVariantResponseDrizzleRepositoryClass;
};
