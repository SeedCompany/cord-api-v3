import { InputType, ObjectType } from '@nestjs/graphql';
import { PaginatedList, PaginationInput } from '~/common';
import { Webhook } from '../../dto';

@InputType()
export class WebhookListInput extends PaginationInput {}

@ObjectType()
export class WebhookList extends PaginatedList(Webhook) {}
