import { faker } from '@faker-js/faker';

// Patch faker email to be more unique
const origEmail = faker.internet.email.bind(faker.internet);
faker.internet.email = (...args) =>
  origEmail(...(args as any)).replace('@', `.${Date.now()}@`);
