import { Injectable } from '@nestjs/common';
import { JsonSet } from '@seedcompany/common';
import {
  type DocumentNode,
  GraphQLError,
  Kind,
  type OperationDefinitionNode,
} from 'graphql';
import { type ID, InputException } from '~/common';
import { SkipLogging } from '../exception/skip-logging.symbol';
import { Yoga } from '../graphql';

@Injectable()
export class WebhookValidator {
  constructor(private readonly yoga: Yoga) {}

  async validate(documentStr: string, key?: ID) {
    const { schema, parse, validate } = this.yoga.getEnveloped();
    let doc: DocumentNode;
    try {
      doc = parse(documentStr);
    } catch (e) {
      if (e instanceof GraphQLError) {
        e.extensions.codes = new JsonSet([
          e.message.startsWith('Syntax Error:') ? 'Parse' : 'Validation',
          'GraphQL',
          'Input', // Injecting this because this is both a input error & a graphql error
          'Client',
        ]);
        // Give field associated with InputException
        e.extensions.field = 'subscription';
      }
      throw e;
    }
    const errors: readonly GraphQLError[] = validate(schema, doc);
    if (errors.length > 0) {
      throw Object.assign(new AggregateError(errors), { [SkipLogging]: true });
    }
    if (doc.definitions[0]?.kind !== 'OperationDefinition') {
      throw new InputException(
        'Given subscription operation is invalid',
        'subscription',
      );
    }
    if (doc.definitions[0].operation !== 'subscription') {
      throw new InputException(
        'Only subscription operations are valid here',
        'subscription',
      );
    }

    let name = doc.definitions[0].name?.value;
    if (!name) {
      if (!key) {
        throw new InputException(
          'Webhooks are identified by their subscription operation name or a key. Please provide one.',
          'subscription',
        );
      }
      name = key;
      Object.assign(doc.definitions[0], {
        name: { kind: Kind.NAME, value: key },
      } satisfies Pick<OperationDefinitionNode, 'name'>);
    }

    return { name, document: doc };
  }
}
