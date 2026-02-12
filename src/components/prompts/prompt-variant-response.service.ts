import { Inject, Injectable } from '@nestjs/common';
import { mapKeys } from '@seedcompany/common';
import { lowerCase } from 'lodash';
import { DateTime } from 'luxon';
import {
  type ID,
  mapSecuredValue,
  NotFoundException,
  type Resource,
  type ResourceShape,
  RichTextDocument,
  SecuredList,
  UnauthorizedException,
  type UnsecuredDto,
  type VariantList,
  type VariantOf,
} from '~/common';
import { Identity } from '~/core/authentication';
import { mapListResults } from '~/core/database/results';
import { LiveQueryStore } from '~/core/live-query';
import { ResourceLoader } from '~/core/resources';
import {
  Privileges,
  type UserResourcePrivileges,
  withVariant,
} from '../authorization';
import {
  type ChangePrompt,
  type ChoosePrompt,
  type Prompt,
  type PromptVariantResponse,
  type PromptVariantResponseList,
  type UpdatePromptVariantResponse,
  type VariantResponse,
} from './dto';
import { type PromptVariantResponseRepository } from './prompt-variant-response.repository';

export const PromptVariantResponseListService = <
  TParentResourceStatic extends ResourceShape<Resource>,
  TResourceStatic extends ResourceShape<PromptVariantResponse<TVariant>> & {
    Variants: VariantList<TVariant>;
  },
  TVariant extends string = VariantOf<TResourceStatic>,
>(
  repo: ReturnType<
    typeof PromptVariantResponseRepository<
      TParentResourceStatic,
      TResourceStatic,
      TVariant
    >
  >,
) => {
  @Injectable()
  abstract class PromptVariantResponseListServiceClass {
    @Inject(Privileges)
    protected readonly privileges: Privileges;
    @Inject() protected readonly identity: Identity;
    @Inject(ResourceLoader)
    protected readonly resources: ResourceLoader;
    @Inject(LiveQueryStore)
    protected readonly liveQueryStore: LiveQueryStore;
    @Inject(repo)
    protected readonly repo: InstanceType<typeof repo>;

    protected get resource() {
      return this.repo.resource.type;
    }

    protected get resourcePrivileges() {
      return this.privileges.forResource<
        typeof PromptVariantResponse<TVariant>
      >(this.resource as any);
    }

    protected abstract getPrivilegeContext(
      dto: UnsecuredDto<Resource>,
    ): Promise<any>;

    protected abstract getPrompts(): Promise<readonly Prompt[]>;

    async getPromptById(id: ID<Prompt>) {
      const prompts = await this.getPrompts();
      const prompt = prompts.find((p) => p.id === id);
      if (!prompt) {
        throw new NotFoundException('Could not find prompt', 'prompt');
      }
      return prompt;
    }

    async list(parent: Resource): Promise<PromptVariantResponseList<TVariant>> {
      const context = parent as any;
      const edge = this.repo.edge.forContext(context);
      const canRead = edge.can('read');
      if (!canRead) {
        return {
          ...SecuredList.Redacted,
          available: { prompts: [], variants: [] },
        };
      }
      const results = await this.repo.list(parent.id);

      const privileges = this.resourcePrivileges.forContext(context);

      const [secured, prompts, variants] = await Promise.all([
        mapListResults(results, async (dto) => await this.secure(dto)),
        this.getPrompts(),
        this.getAvailableVariants(privileges),
      ]);
      return {
        canRead,
        canCreate: edge.can('create'),
        ...secured,
        available: { prompts, variants },
      };
    }

    protected async getAvailableVariants(
      privileges: UserResourcePrivileges<
        typeof PromptVariantResponse<TVariant>
      >,
    ) {
      const variants = this.resource.Variants.filter((variant) =>
        privileges
          .forContext(withVariant(privileges.context!, variant.key))
          .can('edit', 'responses'),
      );
      return variants;
    }

    protected async secure(
      dto: UnsecuredDto<PromptVariantResponse<TVariant>>,
    ): Promise<PromptVariantResponse<TVariant>> {
      const context = await this.getPrivilegeContext(dto);
      const privileges = this.resourcePrivileges.forContext(context);
      const responses = mapKeys.fromList(dto.responses, (r) => r.variant).asMap;
      const secured = privileges.secure(dto);
      return {
        ...secured,
        prompt: await mapSecuredValue(secured.prompt, (id) =>
          this.getPromptById(id),
        ),
        responses: this.resource.Variants.flatMap((variant) => {
          const variantPrivileges = privileges.forContext(
            withVariant(privileges.context!, variant.key),
          );
          if (!variantPrivileges.can('read', 'responses')) {
            return [];
          }
          const response = responses.get(variant.key);
          return {
            variant,
            response: {
              canRead: true,
              value: response?.response,
              canEdit: variantPrivileges.can('edit', 'responses'),
            },
            creator: {
              canRead: variantPrivileges.can('read', 'creator'),
              canEdit: variantPrivileges.can('edit', 'creator'),
              value: response?.creator,
            },
            modifiedAt: response?.modifiedAt,
          };
        }),
      };
    }

    async create(
      input: ChoosePrompt,
    ): Promise<PromptVariantResponse<TVariant>> {
      const edge = this.repo.edge;
      const parent = await this.resources.load(
        // @ts-expect-error yeah we are assuming it's registered
        edge.resource,
        input.resource,
      );
      const privileges = edge.forContext(
        // @ts-expect-error yeah it's not unsecured, but none of our conditions actually needs that.
        parent,
      );
      privileges.verifyCan('create');

      await this.getPromptById(input.prompt);

      const dto = await this.repo.create(input);

      // @ts-expect-error yeah, we are assuming it has an id and typename
      this.liveQueryStore.invalidate([parent.__typename, parent.id]);

      return await this.secure(dto);
    }

    async changePrompt(
      input: ChangePrompt,
    ): Promise<PromptVariantResponse<TVariant>> {
      const response = await this.repo.readOne(input.id);
      const context = await this.getPrivilegeContext(response);
      const privileges = this.resourcePrivileges.forContext(context);
      privileges.verifyCan('edit', 'prompt');

      await this.getPromptById(input.prompt);

      if (input.prompt !== response.prompt) {
        await this.repo.changePrompt(input);
        this.liveQueryStore.invalidate(`PromptVariantResponse:${input.id}`);
      }

      return await this.secure({ ...response, prompt: input.prompt });
    }

    async submitResponse(
      input: UpdatePromptVariantResponse<TVariant>,
    ): Promise<PromptVariantResponse<TVariant>> {
      const variant = this.resource.Variants.byKey(input.variant);

      const response = await this.repo.readOne(input.id);
      const context = await this.getPrivilegeContext(response);
      const privileges = this.resourcePrivileges.forContext(context);

      const perm = privileges
        .forContext(withVariant(privileges.context!, variant.key))
        .can('edit', 'responses');
      if (!perm) {
        throw new UnauthorizedException(
          `You do not have the permission to edit the "${
            variant.label
          }" response for this ${lowerCase(this.resource.name)}`,
        );
      }

      if (
        !RichTextDocument.isEqual(
          input.response,
          response.responses.find((r) => r.variant === variant.key)?.response,
        )
      ) {
        await this.repo.submitResponse(input);
        this.liveQueryStore.invalidate(`PromptVariantResponse:${input.id}`);
      }

      const session = this.identity.current;
      const responses = mapKeys.fromList(
        response.responses,
        (response) => response.variant,
      ).asMap;
      const updated: UnsecuredDto<PromptVariantResponse<TVariant>> = {
        ...response,
        responses: this.resource.Variants.map(({ key }) => ({
          ...responses.get(key),
          ...(variant.key === key
            ? ({
                variant: key,
                response: input.response,
                // TODO I'm not sure it's right to fallback to the current user...?
                creator: responses.get(key)?.creator ?? { id: session.userId },
                modifiedAt: DateTime.now(),
              } satisfies UnsecuredDto<VariantResponse>)
            : {}),
        })),
      };
      return await this.secure(updated);
    }

    async delete(id: ID<PromptVariantResponse>) {
      const response = await this.repo.readOne(id);

      const context = await this.getPrivilegeContext(response);
      const privileges = this.resourcePrivileges.forContext(context);
      privileges.verifyCan('delete');

      await this.repo.deleteNode(id);

      return response;
    }
  }

  return PromptVariantResponseListServiceClass;
};
