import { groupBy } from '@seedcompany/common';
import { createMetadataDecorator } from '@seedcompany/nest';
import { InputException } from './exceptions';
import { ID } from './id-field';
import { EnhancedResource, ResourceShape } from './resource.dto';
import { UnsecuredDto } from './secured-property';

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

RequiredWhen.verify = <TResourceStatic extends ResourceShape<any>>(
  resource: TResourceStatic,
  obj: UnsecuredDto<TResourceStatic['prototype']>,
) => {
  const res = EnhancedResource.of(resource);
  const missing = [...res.props].flatMap((prop: string) => {
    const condition = RequiredWhenMetadata.get(resource, prop);
    return condition?.isEnabled(obj) &&
      (condition.isMissing?.(obj) ?? obj[prop] == null)
      ? {
          field: condition.field ?? prop,
          description: condition.description,
        }
      : [];
  });
  if (missing.length > 0) {
    throw new MissingRequiredFieldsException(res, { id: obj.id }, missing);
  }
};

export class MissingRequiredFieldsException extends InputException {
  constructor(
    readonly resource: EnhancedResource<any>,
    readonly object: { id: ID },
    readonly missing: ReadonlyArray<{
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
