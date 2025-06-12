import { faker } from '@faker-js/faker';
import { graphql, type InputOf } from '~/graphql';
import { type Tester } from '../setup';
import { fragments } from '../utility';

export const initSessionOnce = () => async (tester: Tester) => {
  if (!(HasSession in tester)) {
    await tester.run(SessionDoc);
  }
  // @ts-expect-error hidden, untyped. Doing this instead of weak cache,
  // so that prototype inheritance is possible.
  tester[HasSession] = true;
  return tester;
};
const HasSession = Symbol('HasSession');
const SessionDoc = graphql(`
  query SessionToken {
    session(browser: true) {
      __typename
    }
  }
`);

export const registerUser =
  (input?: Partial<InputOf<typeof RegisterUserDoc>>) =>
  async (tester: Tester) => {
    await tester.apply(initSessionOnce());
    const res = await tester.run(RegisterUserDoc, {
      input: {
        email: faker.internet.email(),
        password: faker.internet.password(),
        realFirstName: faker.person.firstName(),
        realLastName: faker.person.lastName(),
        displayFirstName: faker.person.firstName(),
        displayLastName: faker.person.lastName(),
        ...input,
      },
    });
    return res.register.user;
  };

const RegisterUserDoc = graphql(
  `
    mutation RegisterUser($input: RegisterUser!) {
      register(input: $input) {
        user {
          ...user
        }
      }
    }
  `,
  [fragments.user],
);

export const login =
  (input: InputOf<typeof LoginDoc>) => async (tester: Tester) => {
    await tester.apply(initSessionOnce());
    await tester.run(LoginDoc, { input });
    return tester;
  };

const LoginDoc = graphql(`
  mutation Login($input: LoginInput!) {
    login(input: $input) {
      user {
        id
      }
    }
  }
`);

export const logout = () => async (tester: Tester) => {
  await tester.run(LogoutDoc);
  return tester;
};

const LogoutDoc = graphql(`
  mutation Logout {
    logout {
      __typename
    }
  }
`);
