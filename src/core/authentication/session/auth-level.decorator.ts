import { keys } from '@seedcompany/common';
import {
  createMetadataDecorator,
  type MadeEnum,
  makeEnum,
} from '@seedcompany/nest';

// Using enum here for IDE jsdoc completion per member.
enum Level {
  /**
   * A user must be logged in with a session.
   * This is the default for GraphQL mutations.
   */
  Authenticated = 'Authenticated',
  /**
   * A user may be logged in, but it's not required.
   * They must have a session established, though.
   * This is the default for GraphQL queries/subscriptions or anything else.
   */
  Anonymous = 'Anonymous',
  /**
   * A user does not even need a session established.
   * This is a completely anonymous request.
   */
  Sessionless = 'Sessionless',
}

// typecasting here allows IDE smarts up to the native enum.
const made = makeEnum(keys(Level)) as typeof Level &
  Omit<MadeEnum<`${Level}`>, `${Level}`>;

export const AuthLevel = Object.assign(
  createMetadataDecorator({
    setter: (level: `${Level}`) => level,
    types: ['class', 'method'],
  }),
  made,
);
export type AuthLevel = typeof AuthLevel.$value;
