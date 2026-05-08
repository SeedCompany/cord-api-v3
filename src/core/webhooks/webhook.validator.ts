import { Injectable } from '@nestjs/common';
import { JsonSet } from '@seedcompany/common';
import {
  assertName,
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

    const operationDefinitionNodes = doc.definitions.filter(
      (definition): definition is OperationDefinitionNode =>
        definition.kind === 'OperationDefinition',
    );

    if (operationDefinitionNodes.length === 0) {
      throw new InputException(
        'No subscription operation found in the provided document',
        'subscription',
      );
    }

    if (operationDefinitionNodes.length > 1) {
      throw new InputException(
        'Only a single operation of type subscription is allowed per document',
        'subscription',
      );
    }

    const operationDefinitionNode = operationDefinitionNodes[0]!;
    if (operationDefinitionNode.operation !== 'subscription') {
      throw new InputException(
        'Only subscription operations are valid here',
        'subscription',
      );
    }

    const name =
      operationDefinitionNode.name?.value ??
      this.validateAndGetNodeNameFromKey(key);

    if (!operationDefinitionNode.name) {
      Object.assign(operationDefinitionNode, {
        name: { kind: Kind.NAME, value: name },
      } satisfies Pick<OperationDefinitionNode, 'name'>);
    }

    return { name, document: doc };
  }

  private validateAndGetNodeNameFromKey(key: ID | undefined): string {
    if (!key) {
      throw new InputException(
        'Webhooks are identified by their subscription operation name or a key; please provide one.',
        'subscription',
      );
    }

    try {
      assertName(key);
    } catch {
      throw new InputException(
        'Key must be a valid GraphQL name (letters, digits, underscores; cannot start with a digit)',
        'key',
      );
    }

    return key;
  }
}
