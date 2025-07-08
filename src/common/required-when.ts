import {
  asNonEmptyArray,
  groupBy,
  type NonEmptyArray,
} from '@seedcompany/common';
import { createMetadataDecorator } from '@seedcompany/nest';
import { InputException } from './exceptions';
import { type ID } from './id-field';
import { EnhancedResource, type ResourceShape } from './resource.dto';
import { type UnsecuredDto } from './secured-property';

const RequiredWhenMetadata = createMetadataDecorator({
  types: ['property'],
  setter: (options: {
    description: string;
    isEnabled: (obj: any) => boolean;
    isMissing?: (obj: any) => boolean;
    field?: string;
  }) => options,
});

/**
 * @experimental Carson is not really happy with this API.
 * It doesn't work for nested resources.
 */
export const RequiredWhen =
  <TResourceStatic extends ResourceShape<any>>(
    // eslint-disable-next-line @seedcompany/no-unused-vars
    resource: () => TResourceStatic,
  ) =>
  (requirementOptions: {
    isEnabled: (obj: UnsecuredDto<TResourceStatic['prototype']>) => boolean;
    description: string;
  }) =>
  (fieldOptions?: {
    isMissing?: (obj: UnsecuredDto<TResourceStatic['prototype']>) => boolean;
    field?: string;
  }): ((
    target: TResourceStatic['prototype'],
    propertyKey: string | symbol,
    nope?: never,
  ) => void) =>
    RequiredWhenMetadata({
      ...requirementOptions,
      ...fieldOptions,
    });

RequiredWhen.calc = <TResourceStatic extends ResourceShape<any>>(
  resource: TResourceStatic,
  obj: UnsecuredDto<TResourceStatic['prototype']>,
) => {
  const res = EnhancedResource.of(resource);
  const conditions = [...res.props].flatMap((prop: string) => {
    const condition = RequiredWhenMetadata.get(resource, prop);
    return condition ? { ...condition, field: prop } : [];
  });
  const missingList = conditions.flatMap((condition) => {
    return condition.isEnabled(obj) &&
      (condition.isMissing?.(obj) ?? obj[condition.field] == null)
      ? {
          field: condition.field,
          description: condition.description,
        }
      : [];
  });
  const missing = asNonEmptyArray(missingList);
  if (missing) {
    const id = obj.id as ID;
    return new MissingRequiredFieldsException(res, { id }, missing);
  }
  return undefined;
};

RequiredWhen.verify = <TResourceStatic extends ResourceShape<any>>(
  resource: TResourceStatic,
  obj: UnsecuredDto<TResourceStatic['prototype']>,
) => {
  const ex = RequiredWhen.calc(resource, obj);
  if (ex) {
    throw ex;
  }
};

export class MissingRequiredFieldsException extends InputException {
  constructor(
    readonly resource: EnhancedResource<any>,
    readonly object: { id: ID },
    readonly missing: NonEmptyArray<{
      readonly field: string;
      readonly description: string;
    }>,
  ) {
    const message = groupBy(missing, (x) => x.description)
      .map((fields) =>
        [
          `The following fields are required when ${fields[0].description}:`,
          ...fields.map((x) => `  - ${x.field}`),
        ].join('\n'),
      )
      .join('\n\n');
    super(message);
  }
}
