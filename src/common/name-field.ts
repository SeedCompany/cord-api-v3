import { applyDecorators } from '@nestjs/common';
import { FieldOptions, TypeMetadataStorage } from '@nestjs/graphql';
import { ReturnTypeFunc } from '@nestjs/graphql/dist/interfaces/return-type-func.interface';
import { LazyMetadataStorage } from '@nestjs/graphql/dist/schema-builder/storages/lazy-metadata.storage';
import { reflectTypeFromMetadata } from '@nestjs/graphql/dist/utils/reflection.utilts';
import { MinLength } from 'class-validator';
import { DbSort } from './db-sort.decorator';
import { Transform } from './transform.decorator';

export const NameField = (options: FieldOptions = {}) =>
  applyDecorators(
    InferredTypeOrStringField(options),
    Transform(({ value }) => {
      if (value === undefined) {
        return undefined;
      }
      if (options.nullable) {
        // Treat null & empty strings as null
        return value?.trim() || null;
      }
      // Null & empty string treated as MinLength validation error
      return value?.trim() ?? '';
    }),
    DbSort((value) => `apoc.text.clean(${value})`),
    MinLength(1)
  );

/**
 * Same as @Field(), just that it uses String type, if one cannot be inferred.
 * Useful for when the type is `string | null`.
 */
const InferredTypeOrStringField =
  (options: FieldOptions): PropertyDecorator | MethodDecorator =>
  (prototype, property, descriptor) => {
    const propertyKey = property as string;
    const applyMetadataFn = () => {
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
      let getType;
      let typeOptions;
      try {
        ({ typeFn: getType, options: typeOptions } = resolveType());
      } catch {
        ({ typeFn: getType, options: typeOptions } = resolveType(() => String));
      }
      TypeMetadataStorage.addClassFieldMetadata({
        name: propertyKey,
        schemaName: options.name || propertyKey,
        typeFn: getType,
        options: typeOptions,
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
