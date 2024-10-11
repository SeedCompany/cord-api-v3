import { node, Query, relation } from 'cypher-query-builder';
import { createRelationships, exp } from '~/core/database/query';
import {
  INotificationStrategy,
  InputOf,
  NotificationStrategy,
} from '../notifications';
import { SimpleTextNotification as SimpleText } from './simple-text-notification.dto';

@NotificationStrategy(SimpleText)
export class SimpleTextNotificationStrategy extends INotificationStrategy<SimpleText> {
  saveForNeo4j(input: InputOf<SimpleText>) {
    return (query: Query) =>
      query
        .apply(
          createRelationships(SimpleText, 'out', {
            reference: ['User', input.reference],
          }),
        )
        .with('*')
        .setValues({ node: { content: input.content } }, true);
  }

  hydrateExtraForNeo4j(outVar: string) {
    return (query: Query) =>
      query
        .optionalMatch([
          node('node'),
          relation('out', '', 'reference'),
          node('u', 'User'),
        ])
        .return(exp({ reference: 'u { .id }' }).as(outVar));
  }
}
