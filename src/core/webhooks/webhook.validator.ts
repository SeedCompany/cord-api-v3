import { Injectable } from '@nestjs/common';
import { type DocumentNode, type GraphQLError } from 'graphql';
import { InputException } from '~/common';
import { SkipLogging } from '../exception/skip-logging.symbol';
import { Yoga } from '../graphql';

@Injectable()
export class WebhookValidator {
  constructor(private readonly yoga: Yoga) {}

  async validate(documentStr: string) {
    const { schema, parse, validate } = this.yoga.getEnveloped();
    const doc: DocumentNode = parse(documentStr);
    const errors: readonly GraphQLError[] = validate(schema, doc);
    if (errors.length > 0) {
      throw Object.assign(new AggregateError(errors), { [SkipLogging]: true });
    }
    if (doc.definitions[0]?.kind !== 'OperationDefinition') {
      throw new InputException('Given operation is invalid', 'operation');
    }
    if (doc.definitions[0].operation !== 'subscription') {
      throw new InputException(
        'Only subscription operations are valid here',
        'operation',
      );
    }

    const name = doc.definitions[0].name?.value;
    if (!name) {
      throw new InputException(
        'Webhooks are identified by their operation name. Please provide one.',
        'operation',
      );
    }

    return { name, document: doc };
  }
}
