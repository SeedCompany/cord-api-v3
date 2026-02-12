import { applyDecorators } from '@nestjs/common';
import { type FieldOptions, TypeMetadataStorage } from '@nestjs/graphql';
import { type ReturnTypeFunc } from '@nestjs/graphql/dist/interfaces/return-type-func.interface';
import { LazyMetadataStorage } from '@nestjs/graphql/dist/schema-builder/storages/lazy-metadata.storage.js';
import { reflectTypeFromMetadata } from '@nestjs/graphql/dist/utils/reflection.utilts.js';
import { Transform } from 'class-transformer';
import { MinLength } from 'class-validator';
import { DbSort } from '~/common/db';

type NameFieldParams = FieldOptions & {
  /**
   * If true, values can be omitted/undefined or null.
   * This will override `optional` if truthy.
   */
  nullable?: true;
  /**
   * If true, values can be omitted/undefined but not null.
   */
  optional?: true;
};

export const NameField = (options: NameFieldParams = {}) =>
  applyDecorators(
    InferredTypeOrStringField({
      ...options,
      nullable: options.optional ?? options.nullable,
    }),
    Transform(({ value }) => {
      if (value === undefined) {
        return undefined;
      }
      if (options.nullable) {
        // Treat null & empty strings as null
        return value?.trim() || null;
      }
      if (options.optional && value === null) {
        // Treat null as an omitted value
        return undefined;
      }
      // Null & empty string treated as MinLength validation error
      return value?.trim() ?? '';
    }),
    DbSort((value) => `apoc.text.clean(${value})`),
    // Using this instead of @IsNotEmpty, as this allows nulls.
    MinLength(1, { message: 'Cannot be empty' }),
  );

/**
 * Same as @Field(), just that it uses String type, if one cannot be inferred.
 * Useful for when the type is `string | null`.
 */
const InferredTypeOrStringField =
  (options: FieldOptions): PropertyDecorator | MethodDecorator =>
  (prototype, property, descriptorRaw) => {
    const propertyKey = property as string;
    const applyMetadataFn = () => {
      // fix linter false positive thinking it always exists, property decorators don't have it
      const descriptor = descriptorRaw as
        | TypedPropertyDescriptor<unknown>
        | undefined;
      const isResolver = !!descriptor;
      const isResolverMethod = !!descriptor?.value;
      const resolveType = (typeFn?: ReturnTypeFunc) =>
        reflectTypeFromMetadata({
          metadataKey: isResolverMethod ? 'design:returntype' : 'design:type',
          prototype,
          propertyKey: propertyKey,
          explicitTypeFn: typeFn,
          typeOptions: options,
        });
      let resolved;
      try {
        resolved = resolveType();
      } catch {
        resolved = resolveType(() => String);
      }
      TypeMetadataStorage.addClassFieldMetadata({
        name: propertyKey,
        schemaName: options.name || propertyKey,
        typeFn: resolved.typeFn!,
        options: resolved.options,
        target: prototype.constructor,
        description: options.description,
        deprecationReason: options.deprecationReason,
        complexity: options.complexity,
        middleware: options.middleware,
      });
      if (isResolver) {
        TypeMetadataStorage.addResolverPropertyMetadata({
          kind: 'internal',
          methodName: propertyKey,
          schemaName: options.name || propertyKey,
          target: prototype.constructor,
          complexity: options.complexity,
        });
      }
    };
    LazyMetadataStorage.store(prototype.constructor as any, applyMetadataFn, {
      isField: true,
    });
  };
