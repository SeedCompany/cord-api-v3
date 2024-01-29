import {
  ArgumentMetadata,
  Injectable,
  PipeTransform,
  Scope,
} from '@nestjs/common';
import { Args, ArgsOptions, ID as IDType } from '@nestjs/graphql';
import { Resolver } from '@nestjs/graphql/dist/enums/resolver.enum.js';
import { RESOLVER_TYPE_METADATA as TypeKey } from '@nestjs/graphql/dist/graphql.constants.js';
import { ID, InputException, ServerException } from '~/common';
import { createAugmentedMetadataPipe } from '~/common/augmented-metadata.pipe';
import { ValidateIdPipe } from '~/common/validators/short-id.validator';
import { ResourceLoader } from '~/core/resources';

const pipeMetadata = createAugmentedMetadataPipe<{
  mutation: boolean;
  fieldName: string;
}>();

export const ChangesetArg = (
  options?: Omit<ArgsOptions, 'type'>,
): ParameterDecorator => {
  return (target, methodName, argIndex) => {
    let type: Resolver;
    const resolved: ArgsOptions = {
      nullable: true,
      name: 'changeset',
      ...options,
      type: () => IDType,
    };
    Args(
      resolved,
      ValidateIdPipe,
      pipeMetadata.attach(() => ({
        mutation: type === Resolver.MUTATION,
        fieldName: resolved.name!,
      })),
      ValidateChangesetEditablePipe,
    )(target, methodName, argIndex);

    // method metadata is set after parameter metadata, so wait until next tick
    // to determine if method is query or mutation to set default description.
    process.nextTick(() => {
      type = Reflect.getMetadata(TypeKey, (target as any)[methodName!]);
      if (!type) {
        throw new ServerException(
          'Something went wrong trying to determine operation type',
        );
      }
      if (resolved.description) {
        return;
      }
      resolved.description =
        type === Resolver.MUTATION
          ? 'A changeset ID to associate these changes with'
          : 'Load the object with these changes in this changeset';
    });
  };
};

@Injectable({ scope: Scope.REQUEST })
export class ValidateChangesetEditablePipe implements PipeTransform {
  constructor(private readonly resources: ResourceLoader) {}

  async transform(changesetId: ID | undefined, metadata: ArgumentMetadata) {
    const { mutation, fieldName } = pipeMetadata.get(metadata);
    if (!changesetId || !mutation) {
      return null;
    }

    const changeset = await this.resources.load('Changeset', changesetId);
    if (!changeset.editable) {
      throw new InputException('Changeset is not editable', fieldName);
    }

    return changesetId;
  }
}
