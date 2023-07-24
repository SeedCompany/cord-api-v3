import { ArgsType } from '@nestjs/graphql';
import { EmailField } from '~/common';

@ArgsType()
export abstract class CheckEmailArgs {
  @EmailField()
  readonly email: string;
}
