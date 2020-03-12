import { AWSError, Request, SES } from 'aws-sdk';
import * as faker from 'faker';
import { Readable } from 'stream';
import { ConditionalKeys } from 'type-fest';

export const mockSES = () => {
  const ses = new SES();

  // New variable for each mock call so that TS keeps the augmented type
  // (service with the mocks added).
  const ses2 = awsMock(ses, 'sendEmail', () => ({
    MessageId: faker.random.alphaNumeric(),
  }));

  return ses2;
};

/**
 * This allows us to declare the type of our mocked service in our tests
 * without having to repeat all the mock augments.
 */
export type MockedSES = ReturnType<typeof mockSES>;

/**
 * Replaces the given service method with a mock.
 *
 * The given implementation is wrapped with a fake request so it doesn't need
 * to provide all of that just the specifics to of the service call.
 *
 * The returned value is the same service object but it's type is augmented so
 * that the method is also of type mock. This way the mock properties can still
 * be accessed with type safety.
 *
 * @param obj An AWS Service
 * @param method The method on the service
 * @param implementation The promised result. We'll handle wrapping it.
 */
const awsMock = <T, M extends ConditionalKeys<T, (...args: any) => any>>(
  obj: T,
  method: M,
  implementation: (
    ...args: Parameters<T[M]>
  ) => ReturnType<T[M]> extends Request<infer R, any> ? R : ReturnType<T[M]>
): T & { [K in M]: T[M] & jest.Mock<ReturnType<T[M]>, Parameters<T[M]>> } => {
  obj[method] = jest.fn((...args) =>
    fakeRequest(implementation(...args))
  ) as T[M] & jest.Mock<ReturnType<T[M]>, Parameters<T[M]>>;

  return obj;
};

const fakeRequest = <T>(obj: T): Request<T, AWSError> => {
  const request = {
    abort(): void {
      // nope
    },
    eachPage(): void {
      // nope
    },
    isPageable(): boolean {
      return false;
    },
    startTime: new Date(),
    send(): void {
      // nope
    },
    on() {
      return request;
    },
    onAsync() {
      return request;
    },
    httpRequest: {
      pathname: () => '',
      search: '',
      body: '',
      endpoint: {
        host: '',
        hostname: '',
        href: '',
        port: 80,
        protocol: 'http',
      },
      headers: {},
      method: 'GET',
      path: '',
    },
    createReadStream: () => Readable.from([]),
    promise: async () => ({
      ...obj,
      $response: {
        hasNextPage: () => false,
        error: undefined,
        nextPage: () => {
          /* nope */
        },
        redirectCount: 0,
        requestId: '',
        retryCount: 0,
        data: undefined,
        httpResponse: {
          body: '',
          headers: {},
          statusCode: 200,
          statusMessage: '',
          streaming: false,
          createUnbufferedStream: () => ({}),
        },
      },
    }),
  };
  return request;
};
