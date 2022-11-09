import { Inject, Injectable } from '@nestjs/common';
import { lowerCase } from 'lodash';
import {
  IdOf,
  mapFromList,
  mapSecuredValue,
  NotFoundException,
  Resource,
  ResourceShape,
  RichTextDocument,
  SecuredList,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '~/common';
import { ResourceLoader } from '~/core';
import { mapListResults } from '~/core/database/results';
import { Privileges, UserResourcePrivileges } from '../authorization';
import { withVariant } from '../authorization/policies/conditions';
import {
  ChangePrompt,
  ChoosePrompt,
  Prompt,
  PromptVariantResponse,
  PromptVariantResponseList,
  UpdatePromptVariantResponse,
} from './dto';
import { VariantList, VariantOf } from './dto/variant.dto';
import { PromptVariantResponseRepository } from './prompt-variant-response.repository';

export const PromptVariantResponseListService = <
  TParentResourceStatic extends ResourceShape<Resource>,
  TResourceStatic extends ResourceShape<PromptVariantResponse<TVariant>> & {
    Variants: VariantList<TVariant>;
  },
  TVariant extends string = VariantOf<TResourceStatic>
>(
  repo: ReturnType<
    typeof PromptVariantResponseRepository<
      TParentResourceStatic,
      TResourceStatic,
      TVariant
    >
  >
) => {
  @Injectable()
  abstract class PromptVariantResponseListServiceClass {
    @Inject(Privileges)
    protected readonly privileges: Privileges;
    @Inject(ResourceLoader)
    protected readonly resources: ResourceLoader;
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
      dto: UnsecuredDto<Resource>
    ): Promise<any>;

    protected abstract getPrompts(): Promise<readonly Prompt[]>;

    async getPromptById(id: IdOf<Prompt>) {
      const prompts = await this.getPrompts();
      const prompt = prompts.find((p) => p.id === id);
      if (!prompt) {
        throw new NotFoundException('Could not find prompt', 'prompt');
      }
      return prompt;
    }

    async list(
      parent: Resource,
      session: Session
    ): Promise<PromptVariantResponseList<TVariant>> {
      const context = parent as any;
      const edge = this.repo.edge.forUser(session, context);
      const canRead = edge.can('read');
      if (!canRead) {
        return {
          ...SecuredList.Redacted,
          available: { prompts: [], variants: [] },
        };
      }
      const results = await this.repo.list(parent.id, session);

      const privileges = this.resourcePrivileges.forUser(session, context);

      const [secured, prompts, variants] = await Promise.all([
        mapListResults(results, async (dto) => await this.secure(dto, session)),
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
      privileges: UserResourcePrivileges<typeof PromptVariantResponse<TVariant>>
    ) {
      const variants = this.resource.Variants.filter((variant) =>
        privileges
          .forContext(withVariant(privileges.context!, variant.key))
          .can('edit', 'responses')
      );
      return variants;
    }

    protected async secure(
      dto: UnsecuredDto<PromptVariantResponse<TVariant>>,
      session: Session
    ): Promise<PromptVariantResponse<TVariant>> {
      const context = await this.getPrivilegeContext(dto);
      const privileges = this.resourcePrivileges.forUser(session, context);
      const responses = mapFromList(dto.responses, (response) => [
        response.variant,
        response,
      ]);
      const secured = privileges.secure(dto);
      return {
        ...secured,
        prompt: await mapSecuredValue(secured.prompt, (id) =>
          this.getPromptById(id)
        ),
        responses: this.resource.Variants.flatMap((variant) => {
          const variantPrivileges = privileges.forContext(
            withVariant(privileges.context!, variant.key)
          );
          if (!variantPrivileges.can('read', 'responses')) {
            return [];
          }
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
          const response = (responses as Partial<typeof responses>)[
            variant.key
          ];
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
      session: Session
    ): Promise<PromptVariantResponse<TVariant>> {
      const edge = this.repo.edge;
      const parent = await this.resources.load(
        // @ts-expect-error yeah we are assuming it's registered
        edge.resource,
        input.resource
      );
      const privileges = edge.forUser(
        session,
        // @ts-expect-error yeah it's not unsecured, but none of our conditions actually needs that.
        parent
      );
      privileges.verifyCan('create');

      await this.getPromptById(input.prompt);

      const dto = await this.repo.create(input, session);

      return await this.secure(dto, session);
    }

    async changePrompt(
      input: ChangePrompt,
      session: Session
    ): Promise<PromptVariantResponse<TVariant>> {
      const response = await this.repo.readOne(input.id, session);
      const context = await this.getPrivilegeContext(response);
      const privileges = this.resourcePrivileges.forUser(session, context);
      privileges.verifyCan('edit', 'prompt');

      await this.getPromptById(input.prompt);

      if (input.prompt !== response.prompt) {
        await this.repo.changePrompt(input, session);
      }

      return await this.secure({ ...response, prompt: input.prompt }, session);
    }

    async submitResponse(
      input: UpdatePromptVariantResponse<TVariant>,
      session: Session
    ): Promise<PromptVariantResponse<TVariant>> {
      const variant = this.resource.Variants.byKey(input.variant);

      const response = await this.repo.readOne(input.id, session);
      const context = await this.getPrivilegeContext(response);
      const privileges = this.resourcePrivileges.forUser(session, context);

      const perm = privileges
        .forContext(withVariant(privileges.context!, variant.key))
        .can('edit', 'responses');
      if (!perm) {
        throw new UnauthorizedException(
          `You do not have the permission to edit the "${
            variant.label
          }" response for this ${lowerCase(this.resource.name)}`
        );
      }

      if (
        !RichTextDocument.isEqual(
          input.response,
          response.responses.find((r) => r.variant === variant.key)?.response
        )
      ) {
        await this.repo.submitResponse(input, session);
      }

      const updated: UnsecuredDto<PromptVariantResponse<TVariant>> = {
        ...response,
        responses: response.responses.map((response) => ({
          ...response,
          response:
            response.variant !== variant.key
              ? response.response
              : input.response,
        })),
      };
      return await this.secure(updated, session);
    }

    async delete(id: IdOf<PromptVariantResponse>, session: Session) {
      const response = await this.repo.readOne(id, session);

      const context = await this.getPrivilegeContext(response);
      const privileges = this.resourcePrivileges.forUser(session, context);
      privileges.verifyCan('delete');

      await this.repo.deleteNode(id);

      return response;
    }
  }

  return PromptVariantResponseListServiceClass;
};
