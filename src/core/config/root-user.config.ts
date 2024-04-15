import { v5 as uuidV5 } from 'uuid';
import type { ID } from '~/common';
import { EnvironmentService } from './environment.service';

const isDev = process.env.NODE_ENV === 'development';

export const UserNs = '7ee19032-2a96-474a-824d-a9c950b06f14';

export const RootUserAlias = 'root';

export const determineRootUser = (env: EnvironmentService) => {
  const user = JSON.parse(env.string('ROOT_USER').optional('{}')) as {
    [_ in 'id' | 'email' | 'password']?: string;
  };
  const email =
    env.string('ROOT_USER_EMAIL').optional() ?? user.email ?? 'devops@tsco.org';
  const password =
    env.string('ROOT_USER_PASSWORD').optional() ??
    user.password ??
    env.string('ROOT_ADMIN_PASSWORD').optional() ??
    'admin';
  const id =
    env.string('ROOT_USER_ID').optional() ??
    user.id ??
    // Use static ID in dev, so that devs can change email/password while
    // still sharing the same ID.
    (isDev ? 'd1bebdaa-efcf-57ee-84cd-0b2bfa01eaa7' : undefined) ??
    // Otherwise in production if ID has not been provided, hash it from
    // the email & password.
    uuidV5(`${email}\0${password}`, UserNs);
  return { id: id as ID, email, password } as const;
};
