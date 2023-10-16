import { InputType, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DataObject,
  NameField,
  SecuredProperty,
  SecuredProps,
} from '../../../common';

@ObjectType()
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
}

@ObjectType({ description: 'an address' })
export class SecuredMailingAddress extends SecuredProperty(MailingAddress, {
  nullable: true,
}) {}
