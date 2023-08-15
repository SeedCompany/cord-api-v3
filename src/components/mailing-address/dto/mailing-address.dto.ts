import { InputType, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { RegisterResource } from '~/core/resources';
import {
  DataObject,
  NameField,
  Resource,
  SecuredProperty,
  SecuredProps,
  Sensitivity,
  SensitivityField,
  SetUnsecuredType,
} from '../../../common';

@RegisterResource()
@ObjectType({
  implements: Resource,
})
@InputType('MailingAddressInput')
export abstract class MailingAddress extends DataObject {
  static readonly Props = keysOf<MailingAddress>();
  static readonly SecuredProps = keysOf<SecuredProps<MailingAddress>>();

  @NameField({ nullable: true })
  readonly addressOne: string | null;

  @NameField({ nullable: true })
  readonly addressTwo: string | null;

  @NameField({ nullable: true })
  readonly city: string | null;

  @NameField({ nullable: true })
  readonly state: string | null;

  @NameField({ nullable: true })
  readonly zip: string | null;

  @NameField({ nullable: true })
  readonly country: string | null;

  @SensitivityField({
    description: "Based on the language's sensitivity",
  })
  @NameField({ nullable: true })
  readonly sensitivity: Sensitivity & SetUnsecuredType<never>;
}

@ObjectType({ description: 'an address' })
export class SecuredMailingAddress extends SecuredProperty(MailingAddress) {}

declare module '~/core/resources/map' {
  interface ResourceMap {
    MailingAddress: typeof MailingAddress;
  }
}
