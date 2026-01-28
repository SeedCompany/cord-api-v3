import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from '@jest/globals';
import {
  delay,
  mapEntries,
  type MaybeAsync,
  patchMethod,
} from '@seedcompany/common';
import {
  createServerAdapter,
  type ServerAdapterRequestHandler,
} from '@whatwg-node/server';
import { type FormattedExecutionResult, print } from 'graphql';
import { DateTime, Duration } from 'luxon';
import type { AddressInfo } from 'net';
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { promisify } from 'node:util';
import {
  bufferTime,
  defer,
  firstValueFrom,
  lastValueFrom,
  merge,
  Subject,
  take,
  timeout,
  toArray,
} from 'rxjs';
import type { SetNonNullable, SetRequired } from 'type-fest';
import { validate as isUUID } from 'uuid';
import { type ID } from '~/common';
import { ConfigService } from '~/core';
import { Identity } from '~/core/authentication';
import { Broadcaster } from '~/core/broadcast';
import { DatabaseMigrationCommand } from '~/core/database/migration/migration.command';
import { WebhookChannelRepository } from '~/core/webhooks/channels/webhook-channel.repository';
import { WebhooksRepository } from '~/core/webhooks/management/webhooks.repository';
import { WebhookListener } from '~/core/webhooks/webhook.listener';
import {
  type FragmentOf,
  graphql,
  type InputOf,
  type ResultOf,
  type VariablesOf,
} from '~/graphql';
import { ProjectChannels } from '../src/components/project/project.channels';
import { SubscriptionChannelVersion } from '../src/subscription-channel-version';
import { createProject } from './operations/project';
import {
  createApp,
  createTesterWithRole,
  type IdentifiedTester,
  type TestApp,
  type Tester,
} from './setup';
import { GqlError } from './setup/gql-client/gql-result';

const SHORT = +Duration.from('30s');

describe('Move to Generic Subscriptions Tests', () => {
  it.todo(
    'should execute subscription resolver with webhook owner permissions',
  );

  it.todo('should only access data webhook owner has permission to see');
});

describe('Webhooks', () => {
  let app: TestApp;
  let tester: IdentifiedTester;

  beforeAll(async () => {
    app = await createApp({
      config: {
        webhooks: {
          requestTimeout: Duration.from('5s'),
        },
      },
    });
    tester = await createTesterWithRole(app, 'RegionalDirector');
  });

  describe('Management', () => {
    let receiver: { url: string } & AsyncDisposable;
    beforeAll(async () => {
      receiver = await serve(handleRequest(new Subject()));
    });
    afterAll(async () => {
      await receiver[Symbol.asyncDispose]();
    });

    describe('Saving / Creation', () => {
      it('should create a new webhook with valid subscription document', async () => {
        const webhook = await tester.apply(
          webhooks.save({
            subscription: graphql(`
              subscription ProjectCreated {
                projectCreated {
                  project {
                    id
                    name {
                      value
                    }
                  }
                }
              }
            `),
            url: receiver.url,
            key: 'MyWebhook' as ID,
          }),
        );

        expect(webhook).toBeTruthy();
        expect(webhook.id).toBeTruthy();
        expect(webhook.key).toBe('MyWebhook');
        expect(webhook.subscription).toContain('subscription ProjectCreated');
        expect(webhook.url).toBe(receiver.url);
        expect(webhook.valid).toBe(true);
        expect(webhook.secret).toBeTruthy();
      });

      it('should generate key from operation name when key not provided', async () => {
        const webhook = await tester.apply(
          webhooks.save({
            subscription: graphql(`
              subscription NotificationAdded {
                notificationAdded {
                  notification {
                    id
                  }
                }
              }
            `),
            url: receiver.url,
          }),
        );

        expect(webhook.key).toBe('NotificationAdded');
      });

      it('should accept subscriptions as strings', async () => {
        const subscription = `
          subscription NotificationAdded {
            notificationAdded {
              notification {
                id
              }
            }
          }
        `;
        const webhook = await tester.apply(
          webhooks.save({
            subscription,
            url: receiver.url,
          }),
        );
        expect(webhook.key).toBe('NotificationAdded');
      });

      it('should update existing webhook when using same key', async () => {
        const firstWebhook = await tester.apply(
          webhooks.save({
            subscription: graphql(`
              subscription TestKey {
                projectCreated {
                  project {
                    id
                  }
                }
              }
            `),
            url: `${receiver.url}/first`,
          }),
        );

        const secondWebhook = await tester.apply(
          webhooks.save({
            subscription: graphql(`
              subscription TestKey {
                projectCreated {
                  project {
                    id
                    name {
                      value
                    }
                  }
                }
              }
            `),
            url: `${receiver.url}/second`,
          }),
        );

        expect(secondWebhook.id).toBe(firstWebhook.id);
        expect(secondWebhook.key).toBe('TestKey');
        expect(secondWebhook.url).toBe(`${receiver.url}/second`);
        expect(secondWebhook.subscription).toContain('name');
      });

      it('should reuse same secret for subsequent webhooks by same user', async () => {
        const firstWebhook = await tester.apply(
          webhooks.save({
            subscription: graphql(`
              subscription FirstForSecret {
                projectCreated {
                  project {
                    id
                  }
                }
              }
            `),
            url: receiver.url,
          }),
        );

        const secondWebhook = await tester.apply(
          webhooks.save({
            subscription: graphql(`
              subscription SecondForSecret {
                notificationAdded {
                  notification {
                    id
                  }
                }
              }
            `),
            url: receiver.url,
          }),
        );

        expect(secondWebhook.secret).toBe(firstWebhook.secret);
      });

      describe('Subscription Validation', () => {
        it('should return input error variables are not provided for operation', async () => {
          const op = tester.apply(
            webhooks.save({
              url: receiver.url,
              subscription: graphql(`
                subscription ProjectUpdatedWithVar($project: ID!) {
                  projectUpdated(project: $project) {
                    project {
                      id
                    }
                  }
                }
              `),
              // Missing required variables
            }),
          );
          await expect(op).rejects.toMatchSnapshot();
          await expect(op).rejects.toThrowGqlError({
            code: ['GraphQL', 'Client'],
          });
        });

        it('should return validation error for non-subscription operation', async () => {
          const op = tester.apply(
            webhooks.save({
              url: receiver.url,
              subscription: `
                query GetProjects {
                  projects {
                    items {
                      id
                    }
                  }
                }
              `,
            }),
          );
          await expect(op).rejects.toThrowGqlError({
            code: 'Input',
            field: 'subscription',
          });
          await expect(op).rejects.toMatchSnapshot();
        });

        it('should return validation error for unnamed operation when key is not provided', async () => {
          const op = tester.apply(
            webhooks.save({
              subscription: graphql(`
                subscription {
                  projectCreated {
                    project {
                      id
                    }
                  }
                }
              `),
              url: receiver.url,
            }),
          );
          await expect(op).rejects.toThrowGqlError({
            code: 'Input',
            field: 'subscription',
          });
          await expect(op).rejects.toMatchSnapshot();
        });

        it('should return validation error for invalid GraphQL syntax', async () => {
          const op = tester.apply(
            webhooks.save({
              subscription: `
                subscription InvalidSyntax {
                  projectCreated {
                    project {
                      id
                    }
                  }
                } this is invalid syntax
              `,
              url: receiver.url,
            }),
          );
          await expect(op).rejects.toThrowGqlError({
            code: ['GraphQL', 'Input'],
            field: 'subscription',
          });
          await expect(op).rejects.toMatchSnapshot();
        });

        it('should return validation error for undefined subscription field', async () => {
          const op = tester.apply(
            webhooks.save({
              subscription: `
                subscription UndefinedField {
                  nonExistentSubscription {
                    data {
                      id
                    }
                  }
                }
              `,
              url: receiver.url,
            }),
          );
          await expect(op).rejects.toThrowGqlError({
            code: ['GraphQL', 'Client'],
            // field: 'subscription',
          });
          await expect(op).rejects.toMatchSnapshot();
        });

        it('should not create webhook when validation fails', async () => {
          const listBefore = await tester.apply(webhooks.list());
          const countBefore = listBefore.items.length;

          const saveOp = tester.apply(
            webhooks.save({
              subscription: `
                query InvalidQuery {
                  projects {
                    items {
                      id
                    }
                  }
                }
              `,
              url: receiver.url,
            }),
          );
          await expect(saveOp).rejects.toThrowGqlError();

          const listAfter = await tester.apply(webhooks.list());
          expect(listAfter.items).toHaveLength(countBefore);
        });
      });

      // Only asserting errors here, as the rest of the suite handles the successful case
      describe('URL Challenge', () => {
        it.each([
          {
            name: '404',
            responder: () => new Response('Not Found', { status: 404 }),
          },
          {
            name: '500',
            responder: () => new Response('Server Error', { status: 500 }),
          },
          {
            name: 'timeout',
            responder: async () => {
              await delay('10s');
              return new Response('Server Error', { status: 500 });
            },
          },
          {
            name: 'not json response',
            responder: () => new Response('hi'),
          },
          {
            name: 'missing challenge in response',
            responder: () => Response.json({}),
          },
          {
            name: 'mismatched challenge',
            responder: () => Response.json({ challenge: 'incorrect' }),
          },
          {
            name: 'non existent url',
            // Use a port that's not listening
            url: 'http://localhost:59999/webhook',
            responder: () => Response.error(),
          },
          {
            name: 'DNS resolution failure',
            url: 'http://this-domain-does-not-exist-1234567890.com/webhook',
            responder: () => Response.error(),
          },
        ])(
          '$name',
          async ({
            url,
            responder,
            assertions,
          }: {
            name: string;
            url?: string;
            responder: (req: Request) => MaybeAsync<Response>;
            assertions?: (op: Promise<unknown>) => Promise<void>;
          }) => {
            await using invalidReceiver = await serve(responder);

            const op = tester.apply(
              webhooks.save({
                subscription: graphql(`
                  subscription TestKey {
                    projectCreated {
                      project {
                        id
                      }
                    }
                  }
                `),
                url: url ?? invalidReceiver.url,
              }),
            );
            await assertions?.(op);
            await expect(op).rejects.toThrowGqlError({
              code: ['Input', 'Client'],
              field: 'url',
            });
            await expect(op).rejects.toMatchSnapshot();
          },
        );
      });
    });

    describe('Listing', () => {
      it('should list all webhooks for the requesting user', async () => {
        const newTester = await createTesterWithRole(app, 'StaffMember');

        // Create a few webhooks
        await newTester.apply(
          webhooks.save({
            subscription: graphql(`
              subscription ListTest1 {
                projectCreated {
                  project {
                    id
                  }
                }
              }
            `),
            url: receiver.url,
          }),
        );

        await newTester.apply(
          webhooks.save({
            subscription: graphql(`
              subscription ListTest2 {
                notificationAdded {
                  notification {
                    id
                  }
                }
              }
            `),
            url: receiver.url,
          }),
        );

        const hooks = await newTester.apply(webhooks.list());

        expect(hooks.total).toBe(2);
        expect(hooks.items).toHaveLength(2);
        expect(hooks.items).toContainEqual(
          expect.objectContaining({ key: 'ListTest1' }),
        );
        expect(hooks.items).toContainEqual(
          expect.objectContaining({ key: 'ListTest2' }),
        );
      });

      it('should return empty list when user has no webhooks', async () => {
        // Create a new user who has no webhooks
        const newTester = await createTesterWithRole(app, 'StaffMember');

        const list = await newTester.apply(webhooks.list());

        expect(list.items).toEqual([]);
        expect(list.total).toBe(0);
      });

      it('should only show webhooks owned by requesting user (not other users)', async () => {
        // Create webhook with first tester
        const webhook1 = await tester.apply(
          webhooks.save({
            subscription: graphql(`
              subscription User1Webhook {
                projectCreated {
                  project {
                    id
                  }
                }
              }
            `),
            url: receiver.url,
          }),
        );

        // Create webhook with second tester
        const tester2 = await createTesterWithRole(app, 'StaffMember');
        const webhook2 = await tester2.apply(
          webhooks.save({
            subscription: graphql(`
              subscription User2Webhook {
                projectCreated {
                  project {
                    id
                  }
                }
              }
            `),
            url: receiver.url,
          }),
        );

        const match1 = expect.objectContaining({ id: webhook1.id });
        const match2 = expect.objectContaining({ id: webhook2.id });

        // Check first tester only sees their webhooks
        const list1 = await tester.apply(webhooks.list());
        expect(list1.items).toContainEqual(match1);
        expect(list1.items).not.toContainEqual(match2);

        // Check second tester only sees their webhooks
        const list2 = await tester2.apply(webhooks.list());
        expect(list2.items).not.toContainEqual(match1);
        expect(list2.items).toContainEqual(match2);
      });
    });

    describe('Deleting', () => {
      it('should delete webhook by id and return it', async () => {
        const webhook = await tester.apply(
          webhooks.save({
            subscription: graphql(`
              subscription DeleteById {
                projectCreated {
                  project {
                    id
                  }
                }
              }
            `),
            url: receiver.url,
          }),
        );

        const deleted = await tester.apply(webhooks.delete({ id: webhook.id }));

        expect(deleted).toHaveLength(1);
        expect(deleted[0]!.id).toBe(webhook.id);
        expect(deleted[0]!.key).toBe('DeleteById');

        // Verify it's no longer in the list
        const list = await tester.apply(webhooks.list());
        expect(list.items).not.toContainEqual(
          expect.objectContaining({ id: webhook.id }),
        );
      });

      it('should delete webhook by key and return it', async () => {
        await tester.apply(
          webhooks.save({
            subscription: graphql(`
              subscription DeleteByKey {
                projectCreated {
                  project {
                    id
                  }
                }
              }
            `),
            url: receiver.url,
          }),
        );

        const deleted = await tester.apply(
          webhooks.delete({ key: 'DeleteByKey' as ID }),
        );

        expect(deleted.length).toBe(1);
        expect(deleted[0]!.key).toBe('DeleteByKey');

        // Verify it's no longer in the list
        const list = await tester.apply(webhooks.list());
        expect(list.items).not.toContainEqual(
          expect.objectContaining({ key: 'DeleteByKey' }),
        );
      });

      it('should delete all webhooks by name and return them', async () => {
        const subscription = graphql(`
          subscription DeleteByName {
            projectCreated {
              project {
                id
              }
            }
          }
        `);
        const webhook1 = await tester.apply(
          webhooks.save({
            subscription,
            key: 'sub1' as ID,
            url: receiver.url,
          }),
        );
        const webhook2 = await tester.apply(
          webhooks.save({
            subscription,
            key: 'sub2' as ID,
            url: receiver.url,
          }),
        );

        const deleted = await tester.apply(
          webhooks.delete({ name: 'DeleteByName' }),
        );

        const expectedDeletions = expect.arrayContaining([
          expect.objectContaining({ id: webhook1.id }),
          expect.objectContaining({ id: webhook2.id }),
        ]);

        expect(deleted).toHaveLength(2);
        expect(deleted).toEqual(expectedDeletions);

        // Verify it's no longer in the list
        const list = await tester.apply(webhooks.list());
        expect(list.items).not.toEqual(expectedDeletions);
      });

      it('should not error when webhook already deleted', async () => {
        const webhook = await tester.apply(
          webhooks.save({
            subscription: graphql(`
              subscription DeleteTwice {
                projectCreated {
                  project {
                    id
                  }
                }
              }
            `),
            url: receiver.url,
          }),
        );

        // Delete it once
        await tester.apply(webhooks.delete({ id: webhook.id }));

        // Delete again - should not error
        const deleted = await tester.apply(webhooks.delete({ id: webhook.id }));
        expect(deleted).toEqual([]);
      });

      it('should not affect other user webhooks on deletion', async () => {
        // Create webhook for first user
        const tester1 = await createTesterWithRole(app, 'StaffMember');
        await tester1.apply(
          webhooks.save({
            subscription: graphql(`
              subscription ProjectCreated {
                projectCreated {
                  project {
                    id
                  }
                }
              }
            `),
            url: receiver.url,
          }),
        );

        // Create webhook for second user
        const tester2 = await createTesterWithRole(app, 'StaffMember');
        await tester2.apply(
          webhooks.save({
            subscription: graphql(`
              subscription ProjectCreated {
                projectCreated {
                  project {
                    id
                  }
                }
              }
            `),
            url: receiver.url,
          }),
        );

        // The first user deletes their webhook by the shared name
        const deleted = await tester1.apply(
          webhooks.delete({ name: 'ProjectCreated' }),
        );
        expect(deleted).toHaveLength(1);

        // The second user's webhook should still exist
        const list2 = await tester2.apply(webhooks.list());
        expect(list2.items).toContainEqual(
          expect.objectContaining({ name: 'ProjectCreated' }),
        );
      });
    });

    describe('Rotating Secret', () => {
      it('should rotate webhook secret and return new value', async () => {
        // Create a webhook to get the initial secret
        const webhook = await tester.apply(
          webhooks.save({
            subscription: graphql(`
              subscription RotateTest {
                projectCreated {
                  project {
                    id
                  }
                }
              }
            `),
            url: receiver.url,
          }),
        );

        // Rotate the secret
        const newSecret = await tester.apply(webhooks.rotateSecret());

        expect(newSecret).toBeTruthy();
        expect(typeof newSecret).toBe('string');
        expect(newSecret).not.toBe(webhook.secret);
      });

      it('should update secret on all existing webhooks for user', async () => {
        // Create multiple webhooks
        await tester.apply(
          webhooks.save({
            subscription: graphql(`
              subscription Rotate1 {
                projectCreated {
                  project {
                    id
                  }
                }
              }
            `),
            url: receiver.url,
          }),
        );

        await tester.apply(
          webhooks.save({
            subscription: graphql(`
              subscription Rotate2 {
                notificationAdded {
                  notification {
                    id
                  }
                }
              }
            `),
            url: receiver.url,
          }),
        );

        // Rotate the secret
        const newSecret = await tester.apply(webhooks.rotateSecret());

        // Fetch the webhooks again and check they have the new secret
        const list = await tester.apply(webhooks.list());
        const updatedWebhook1 = list.items.find((w) => w.key === 'Rotate1');
        const updatedWebhook2 = list.items.find((w) => w.key === 'Rotate2');

        expect(updatedWebhook1?.secret).toBe(newSecret);
        expect(updatedWebhook2?.secret).toBe(newSecret);
      });

      it('should apply rotated secret to new webhooks created after', async () => {
        // Create an initial webhook
        await tester.apply(
          webhooks.save({
            subscription: graphql(`
              subscription BeforeRotate {
                projectCreated {
                  project {
                    id
                  }
                }
              }
            `),
            url: receiver.url,
          }),
        );

        // Rotate the secret
        const newSecret = await tester.apply(webhooks.rotateSecret());

        // Create another webhook after rotation
        const webhook2 = await tester.apply(
          webhooks.save({
            subscription: graphql(`
              subscription AfterRotate {
                notificationAdded {
                  notification {
                    id
                  }
                }
              }
            `),
            url: receiver.url,
          }),
        );

        expect(webhook2.secret).toBe(newSecret);
      });

      it('should not affect other users secrets on rotation', async () => {
        // Create webhook for first user
        const webhook1 = await tester.apply(
          webhooks.save({
            subscription: graphql(`
              subscription User1Rotate {
                projectCreated {
                  project {
                    id
                  }
                }
              }
            `),
            url: receiver.url,
          }),
        );

        // Create webhook for second user
        const tester2 = await createTesterWithRole(app, 'StaffMember');
        const webhook2 = await tester2.apply(
          webhooks.save({
            subscription: graphql(`
              subscription User2Rotate {
                projectCreated {
                  project {
                    id
                  }
                }
              }
            `),
            url: receiver.url,
          }),
        );

        expect(webhook1.secret).not.toBe(webhook2.secret);

        // The first user rotates their secret
        const tester1NewSecret = await tester.apply(webhooks.rotateSecret());

        // The second user's webhook should still have their original secret
        const tester2Hooks = await tester2.apply(webhooks.list());
        const updatedWebhook2 = tester2Hooks.items.find(
          (w) => w.id === webhook2.id,
        );

        expect(updatedWebhook2?.secret).toBe(webhook2.secret);
        expect(updatedWebhook2?.secret).not.toBe(tester1NewSecret);
      });
    });
  });

  describe('Execution', () => {
    afterEach(async () => {
      await tester.apply(webhooks.delete({ all: true }));
    });

    describe('when subscribed event occurs', () => {
      let webhook: Webhook;
      const subscription = graphql(`
        subscription WebhookExecution {
          projectCreated {
            projectId
            project {
              id
              name {
                value
              }
            }
          }
        }
      `);

      let events: Subject<WebhookRequest>;
      let receiver: { url: string } & AsyncDisposable;

      let project: Awaited<ReturnType<ReturnType<typeof createProject>>>;
      let request: WebhookRequest;
      let payload: SetNonNullable<
        SetRequired<
          FormattedExecutionResult<
            ResultOf<typeof subscription>,
            Record<string, any>
          >,
          keyof FormattedExecutionResult
        >
      >;

      beforeAll(async () => {
        events = new Subject();
        receiver = await serve(handleRequest(events));

        // Create a webhook that listens for projectCreated events
        webhook = await tester.apply(
          webhooks.save({
            subscription,
            url: receiver.url,
            metadata: { foo: 'bar' },
          }),
        );

        // Listen for webhook event
        const waitingForHook = firstValueFrom(events.pipe(timeout(SHORT)));

        // Create a project which should trigger the webhook
        project = await tester.apply(createProject());

        request = await waitingForHook;

        // Parse the body for use in tests
        payload = JSON.parse(request.body);
      });

      afterAll(async () => {
        await receiver[Symbol.asyncDispose]();
      });

      it('should send POST to webhook URL', () => {
        expect(request.method).toBe('POST');
      });

      it('should set user-agent header to "cord webhook"', () => {
        expect(request.headers.get('user-agent')).toBe('cord webhook');
      });

      it('should set content-type header to application/json', () => {
        expect(request.headers.get('content-type')).toBe('application/json');
      });

      it('should include subscription result data in POST body', () => {
        expect(payload.data).toBeTruthy();
        expect(payload.data.projectCreated).toBeTruthy();
        expect(payload.data.projectCreated.projectId).toBe(project.id);
        expect(payload.data.projectCreated.project.id).toBe(project.id);
        expect(payload.data.projectCreated.project.name.value).toBe(
          project.name.value,
        );
      });

      it('should include webhook info in extensions', () => {
        expect(payload.extensions).toBeTruthy();
        expect(payload.extensions.webhook).toBeTruthy();
        expect(payload.extensions.webhook.id).toBe(webhook.id);
        expect(payload.extensions.webhook.key).toBe(webhook.key);
        expect(payload.extensions.webhook.trigger).toBeTruthy();
        expect(isUUID(payload.extensions.webhook.trigger.id)).toBeTruthy();
        const at = DateTime.fromISO(payload.extensions.webhook.trigger.at);
        expect(+at).toBeLessThan(Date.now());
        expect(+at).toBeGreaterThan(+DateTime.now().minus({ minutes: 5 }));
      });

      it('should include user metadata in extensions.userMetadata', () => {
        expect(payload.extensions.userMetadata).toBeTruthy();
        expect(payload.extensions.userMetadata.foo).toBe('bar');
      });

      it('should include a signature header (t=...,v1=...)', () => {
        expect(request.headers.get('cord-signature')).toMatch(
          /^t=[0-9]+,v1=.+$/,
        );
      });

      describe('Request Signing', () => {
        let signature: SignatureHeader;
        beforeAll(() => {
          signature = parseSignature(request);
        });

        // Consumers use this to prevent replay attacks
        it('should include recent timestamp in signature', () => {
          expect(signature.t).toMatch(/[0-9]+/);
          const timestamp = Number(signature.t);
          const now = DateTime.now();
          expect(timestamp).toBeLessThan(now.toSeconds());
          expect(timestamp).toBeGreaterThan(
            now.minus({ seconds: 10 }).toSeconds(),
          );
        });

        // Consumers use this to know the data sent actually came from us
        it('should verify signature matches body with webhook secret', () => {
          // Compute the expected signature
          const expectedSignature = createHmac('sha256', webhook.secret)
            .update(`${signature.t}.${request.body}`, 'utf8')
            .digest('hex');

          expect(signature.v1).toBe(expectedSignature);
        });
      });
    });

    it('should POST to all webhooks subscribed to same event', async () => {
      const events = new Subject<WebhookRequest>();
      await using receiver = await serve(handleRequest(events));

      // Create two webhooks subscribed to the same event
      await tester.apply(
        webhooks.save({
          subscription: ProjectCreatedId,
          url: receiver.url,
          key: 'MultiWebhook1' as ID,
        }),
      );

      await tester.apply(
        webhooks.save({
          subscription: ProjectCreatedId,
          url: receiver.url,
          key: 'MultiWebhook2' as ID,
        }),
      );

      // Listen for both webhook events
      const waitingForWebhooks = lastValueFrom(
        events.pipe(timeout(SHORT), take(2), toArray()),
      );

      // Trigger the event
      const project = await tester.apply(createProject());

      // Wait for both webhooks to be sent
      const requests = await waitingForWebhooks;

      // Verify both webhooks received the same project data
      const payload1 = JSON.parse(requests[0]!.body);
      const payload2 = JSON.parse(requests[1]!.body);
      expect(payload1.data.projectCreated.project.id).toBe(project.id);
      expect(payload2.data.projectCreated.project.id).toBe(project.id);

      // Confirm signature is generated for every request, even for the same user
      expect(requests[0]!.headers.get('cord-signature')).not.toEqual(
        requests[1]!.headers.get('cord-signature'),
      );
    });

    it('should send to webhooks owned by different users', async () => {
      const events = new Subject<WebhookRequest>();
      await using receiver = await serve(handleRequest(events));

      // Create webhook for first user
      const webhook1 = await tester.apply(
        webhooks.save({
          subscription: ProjectCreatedId,
          url: receiver.url,
        }),
      );

      // Create webhook for second user
      const tester2 = await createTesterWithRole(app, 'RegionalDirector');
      const webhook2 = await tester2.apply(
        webhooks.save({
          subscription: ProjectCreatedId,
          url: receiver.url,
        }),
      );

      // Listen for both webhook events
      const waitingForWebhooks = lastValueFrom(
        events.pipe(timeout(SHORT), take(2), toArray()),
      );

      // Trigger the event (as first user)
      await tester.apply(createProject());

      // Wait for both webhooks
      const requests = await waitingForWebhooks;

      // Verify both webhooks received the event
      const payloads = requests.map((r) => JSON.parse(r.body));
      expect(
        payloads.some((p) => p.extensions.webhook.id === webhook1.id),
      ).toBe(true);
      expect(
        payloads.some((p) => p.extensions.webhook.id === webhook2.id),
      ).toBe(true);
    });

    it('should execute subscription with provided variables', async () => {
      const events = new Subject<WebhookRequest>();
      await using receiver = await serve(handleRequest(events));

      const [project1, project2] = await Promise.all([
        tester.apply(createProject()),
        tester.apply(createProject()),
      ]);

      const SpecificProjectUpdated = graphql(`
        subscription SpecificProjectUpdated($project: ID!) {
          projectUpdated(project: $project) {
            project {
              id
            }
          }
        }
      `);

      const [webhook1, webhook2] = await Promise.all([
        tester.apply(
          webhooks.save({
            url: receiver.url,
            key: `ProjectUpdated:${project1.id}` as ID,
            subscription: SpecificProjectUpdated,
            variables: { project: project1.id },
          }),
        ),
        tester.apply(
          webhooks.save({
            url: receiver.url,
            key: `ProjectUpdated:${project2.id}` as ID,
            subscription: SpecificProjectUpdated,
            variables: { project: project2.id },
          }),
        ),
      ]);

      const UpdateProject = graphql(`
        mutation UpdateProject($input: UpdateProject!) {
          updateProject(input: $input) {
            project {
              id
            }
          }
        }
      `);

      // Emit & collect events for update for project 1
      const waitingForProjectUpdates1 = firstValueFrom(
        events.pipe(bufferTime(SHORT)),
      );
      await tester.run(UpdateProject, {
        input: { id: project1.id, name: `${project1.name.value!} Updated` },
      });
      const requests1 = await waitingForProjectUpdates1;

      expect(requests1).toHaveLength(1);
      const payload1 = JSON.parse(requests1[0]!.body);
      expect(payload1.extensions.webhook.id).toBe(webhook1.id);
      expect(payload1.data.projectUpdated.project.id).toBe(project1.id);

      // Trigger update for project 2
      const waitingForProjectUpdates2 = firstValueFrom(
        events.pipe(bufferTime(SHORT)),
      );
      await tester.run(UpdateProject, {
        input: { id: project2.id, name: `${project2.name.value!} Updated` },
      });
      const requests2 = await waitingForProjectUpdates2;

      expect(requests2).toHaveLength(1);
      const payload2 = JSON.parse(requests2[0]!.body);
      expect(payload2.extensions.webhook.id).toBe(webhook2.id);
      expect(payload2.data.projectUpdated.project.id).toBe(project2.id);
    });

    describe('Consumer Error Handling', () => {
      it('should handle webhook URL returning 404', async () => {
        const events = new Subject<WebhookRequest>();
        await using receiver = await serve(
          handleRequest(
            events,
            async () => new Response('Not Found', { status: 404 }),
          ),
        );

        await tester.apply(
          webhooks.save({
            subscription: ProjectCreatedId,
            url: receiver.url,
            key: 'Test404' as ID,
          }),
        );

        const waitingForWebhook = firstValueFrom(events.pipe(timeout(SHORT)));

        await tester.apply(createProject());

        const request = await waitingForWebhook;
        expect(request).toBeTruthy();

        // Expect the app to be done processing and not crash.
        await app.get(WebhookListener).draining;
      });

      it('should handle webhook URL returning 500', async () => {
        const events = new Subject<WebhookRequest>();
        await using receiver = await serve(
          handleRequest(
            events,
            async () => new Response('Internal Server Error', { status: 500 }),
          ),
        );

        await tester.apply(
          webhooks.save({
            subscription: ProjectCreatedId,
            url: receiver.url,
            key: 'Test500' as ID,
          }),
        );

        const waitingForWebhook = firstValueFrom(events.pipe(timeout(SHORT)));

        await tester.apply(createProject());

        const request = await waitingForWebhook;
        expect(request).toBeTruthy();

        // Expect the app to be done processing and not crash.
        await app.get(WebhookListener).draining;
      });

      it('should handle webhook URL connection timeout', async () => {
        const events = new Subject<WebhookRequest>();
        await using receiver = await serve(
          handleRequest(events, async () => {
            await delay('10s'); // Delay response to simulate timeout
            return new Response();
          }),
        );

        await tester.apply(
          webhooks.save({
            subscription: ProjectCreatedId,
            url: receiver.url,
            key: 'TestTimeout' as ID,
          }),
        );

        const waitingForWebhook = firstValueFrom(events.pipe(timeout(SHORT)));

        await tester.apply(createProject());

        // Should still receive the request even though it will time out on response
        const request = await waitingForWebhook;
        expect(request).toBeTruthy();

        // Expect the app to be done processing and not crash.
        await app.get(WebhookListener).draining;
      });

      it('should handle webhook URL connection refused', async () => {
        // Use a port that's not listening
        const nonExistentUrl = 'http://localhost:59999/webhook';
        await using receiver = await serve(handleRequest());

        const config = {
          subscription: print(ProjectCreatedId),
          url: receiver.url,
          key: 'TestConnectionRefused' as ID,
        };
        await tester.apply(webhooks.save(config));

        // Simulate future URL becoming invalid
        await app.get(Identity).asUser(tester.identity.id, async () => {
          await app.get(WebhooksRepository).save({
            ...config,
            name: 'ProjectCreatedId',
            url: nonExistentUrl,
          });
        });

        await tester.apply(createProject());

        // Expect the app to be done processing and not crash.
        await app.get(WebhookListener).draining;
      });

      it('should handle webhook URL DNS resolution failure', async () => {
        const invalidUrl =
          'http://this-domain-does-not-exist-1234567890.com/webhook';
        await using receiver = await serve(handleRequest());

        const config = {
          subscription: print(ProjectCreatedId),
          url: receiver.url,
          key: 'TestDNSFailure' as ID,
        };
        await tester.apply(webhooks.save(config));

        // Simulate future DNS resolution failure
        await app.get(Identity).asUser(tester.identity.id, async () => {
          await app.get(WebhooksRepository).save({
            ...config,
            name: 'ProjectCreatedId',
            url: invalidUrl,
          });
        });

        await tester.apply(createProject());

        // Expect the app to be done processing and not crash.
        await app.get(WebhookListener).draining;
      });

      it('should continue sending to other webhooks when one fails', async () => {
        const events = new Subject<WebhookRequest>();
        await using receiver = await serve(handleRequest(events));

        // Create webhook that will succeed
        await tester.apply(
          webhooks.save({
            subscription: ProjectCreatedId,
            url: receiver.url,
            key: 'SuccessWebhook' as ID,
          }),
        );

        // Create webhook that will fail (connection refused)
        const config = {
          subscription: print(ProjectCreatedId),
          url: receiver.url,
          key: 'FailWebhook' as ID,
        };
        await tester.apply(webhooks.save(config));
        await app.get(Identity).asUser(tester.identity.id, async () => {
          await app.get(WebhooksRepository).save({
            ...config,
            name: 'ProjectCreatedId',
            url: 'http://localhost:59998/webhook',
          });
        });

        const waitingForWebhook = firstValueFrom(events.pipe(timeout(SHORT)));

        const project = await tester.apply(createProject());

        // The successful webhook should still receive the event
        const request = await waitingForWebhook;
        expect(request).toBeTruthy();
        const payload = JSON.parse(request.body);
        expect(payload.data.projectCreated.project.id).toBe(project.id);

        // Expect the app to be done processing and not crash.
        await app.get(WebhookListener).draining;
      });
    });

    // We find an error trying to process the webhook's subscription.
    // We should POST the error to the webhook,
    // and depending on the error, mark the webhook invalid, to not process
    // any further events through it until the owner updates it.
    describe('Producer Error Handling', () => {
      it('handles webhook subscription becoming stale from schema breaking change', async () => {
        const events = new Subject<WebhookRequest>();
        await using receiver = await serve(handleRequest(events));

        // Create a valid webhook first
        const webhook = await tester.apply(
          webhooks.save({
            subscription: ProjectCreatedId,
            url: receiver.url,
            key: 'StaleWebhook' as ID,
          }),
        );

        // Manually replace the subscription in db with a "faked" old/invalid one.
        const StaleSubscription = `
          subscription ProjectCreatedId {
            projectCreated {
              project {
                id
                oldFieldThatDoesNotExistAnymore
              }
            }
          }
        `;
        await app.get(Identity).asUser(tester.identity.id, async () => {
          await app.get(WebhooksRepository).save({
            key: webhook.key,
            name: webhook.name,
            subscription: StaleSubscription,
            url: webhook.url,
          });
        });

        const waitingForWebhook = firstValueFrom(events.pipe(timeout(SHORT)));

        // Trigger event by creating a project
        await tester.apply(createProject());

        // Receive the webhook with an error
        const request = await waitingForWebhook;

        // Expect error in payload
        const payload = expectErrorPayload(request.body);
        expect(payload.errors[0].message).toContain(
          'oldFieldThatDoesNotExistAnymore',
        );

        // Expect the webhook to be marked as invalid
        const updated = await tester.apply(webhooks.get(webhook.key));
        expect(updated.valid).toBe(false);

        const waitingForWebhook2 = firstValueFrom(
          events.pipe(timeout({ each: SHORT, with: () => [undefined] })),
        );
        // Trigger event by creating a project
        await tester.apply(createProject());
        // Expect to have the invalid webhook ignored
        expect(await waitingForWebhook2).toBe(undefined);
      });

      it('handles subscription resolver throwing', async () => {
        const events = new Subject<WebhookRequest>();
        await using receiver = await serve(handleRequest(events));

        // Create a separate app/tester instance to avoid polluting other tests
        const thisApp = await createApp({
          config: {
            // share db with the suite app for testing perf
            neo4j: app.get(ConfigService).neo4j,
          },
        });
        const thisTester = await createTesterWithRole(
          thisApp,
          'RegionalDirector',
        );

        // Create a valid webhook first
        const webhook = await thisTester.apply(
          webhooks.save({
            subscription: ProjectCreatedId,
            url: receiver.url,
            key: 'ResolverThrowsWebhook' as ID,
          }),
        );

        // Patch projectCreated subscription resolver to one that
        // always throws in the resolver.
        // This could happen in practice even if a GraphQl document is valid.
        // because the resolver rejects some args/input values.
        // Or because of a bug in resolver code.
        patchMethod(thisApp.get(ProjectChannels), 'created', (base) => () => {
          const channel = base();
          patchMethod(channel, 'observe', () => () => {
            throw new Error('Simulated invalid subscription resolution');
          });
          return channel;
        });

        const waitingForWebhook = firstValueFrom(events.pipe(timeout(SHORT)));

        // Trigger event by creating a project
        await thisTester.apply(createProject());

        // Receive the webhook with an error
        const request = await waitingForWebhook;

        expectErrorPayload(request.body);

        // Expect the webhook to be marked as invalid
        const updated = await thisTester.apply(webhooks.get(webhook.key));
        expect(updated.valid).toBe(false);

        await thisApp.get(WebhookListener).draining;
      });

      it('handles error thrown while processing event', async () => {
        const events = new Subject<WebhookRequest>();
        await using receiver = await serve(handleRequest(events));

        // Create a separate app/tester instance to avoid polluting other tests
        const thisApp = await createApp({
          config: {
            // share db with the suite app for testing perf
            neo4j: app.get(ConfigService).neo4j,
          },
        });
        const thisTester = await createTesterWithRole(
          thisApp,
          'RegionalDirector',
        );

        // Create a valid webhook first
        const webhook = await thisTester.apply(
          webhooks.save({
            subscription: ProjectCreatedId,
            url: receiver.url,
            key: 'ProcessingErrorWebhook' as ID,
          }),
        );

        // Patch projectCreated subscription resolver to one that
        // returns emits an error during iteration/observation
        patchMethod(thisApp.get(ProjectChannels), 'created', (base) => () => {
          const channel = base();
          patchMethod(channel, 'observe', () => () => {
            return defer(() => {
              throw new Error('Simulated error during event processing');
            });
          });
          return channel;
        });

        const waitingForWebhook = firstValueFrom(events.pipe(timeout(SHORT)));

        // Trigger event by creating a project
        await thisTester.apply(createProject());

        // Receive the webhook with an error
        const request = await waitingForWebhook;

        expectErrorPayload(request.body, true);

        // Expect the webhook to remain valid since event emission errors
        // don't invalidate the webhook (other events may succeed)
        const refreshed = await thisTester.apply(webhooks.get(webhook.key));
        expect(refreshed.valid).toBe(true);

        await thisApp.get(WebhookListener).draining;
      });
    });
  });

  describe('SubscriptionChannelVersion Increments -> app will recalculate subscriptions', () => {
    it('valid webhook will be updated', async () => {
      // region Arrange previously existing data
      const events = new Subject<WebhookRequest>();
      await using receiver = await serve(handleRequest(events));

      // Use isolated app & db as the db schema version is DB global.
      const isolatedApp = await createApp();
      const isolatedTester = await createTesterWithRole(
        isolatedApp,
        'RegionalDirector',
      );
      // Call db migrate, as would have happened on a previous deployment.
      // For these tests it sets the db version to the current app version
      // without applying any changes, since there is no version previously
      // established in the ephemeral tests db.
      // It would probably be better to move this to db setup as it would
      // mirror prod more closely.
      await isolatedApp.get(DatabaseMigrationCommand).execute();

      // Create a webhook with a valid subscription
      const webhook = await isolatedTester.apply(
        webhooks.save({
          subscription: ProjectCreatedId,
          url: receiver.url,
          key: 'MigrationTestWebhook' as ID,
        }),
      );

      // Verify channels were initially evaluated...not really necessary
      const initialChannels = await isolatedTester.apply(
        webhooks.getChannels(webhook.id),
      );
      expect(initialChannels).toEqual(['project:created']);
      // endregion

      // region Arrange simulated application change to act upon
      // Simulate a schema version change by updating the SubscriptionChannelVersion
      const newVersion = DateTime.now();
      const newApp = await createApp({
        config: {
          // Share db with the suite app
          neo4j: isolatedApp.get(ConfigService).neo4j,
        },
        overrides: (builder) =>
          builder
            .overrideProvider(SubscriptionChannelVersion.TOKEN)
            .useValue(newVersion),
      });

      // Patch projectCreated subscription resolver to observe another channel
      const newChannel = 'project:created:testing-new';
      const broadcaster = newApp.get(Broadcaster);
      patchMethod(newApp.get(ProjectChannels), 'created', (base) => () => {
        const channel = base();
        patchMethod(channel, 'observe', (base) => () => {
          return merge(base(), broadcaster.channel<any>(newChannel).observe());
        });
        return channel;
      });
      // endregion

      // region Act
      // Call db migrate, as would happen on deployment, which should trigger webhook migration
      await newApp.get(DatabaseMigrationCommand).execute();
      // endregion

      // region Assert
      // Verify the webhook is still valid after recalculation
      const newTester = await isolatedTester.move(newApp);
      const refreshed = await newTester.apply(webhooks.get(webhook.key));
      expect(refreshed.valid).toBe(true);

      // Just assert that the new channel exists for the webhook.
      // Don't bother with execution as this has already been tested elsewhere.
      const channels = await newTester.apply(webhooks.getChannels(webhook.id));
      expect(channels).toContain(newChannel);
      // endregion
    });

    it('invalid webhook will be marked invalid & error payload sent', async () => {
      // region Arrange previously existing data
      const events = new Subject<WebhookRequest>();
      await using receiver = await serve(handleRequest(events));

      // Use isolated app & db as the db schema version is DB global.
      const isolatedApp = await createApp();
      const isolatedTester = await createTesterWithRole(
        isolatedApp,
        'RegionalDirector',
      );
      // Call db migrate, as would have happened on a previous deployment.
      // For these tests it sets the db version to the current app version
      // without applying any changes, since there is no version previously
      // established in the ephemeral tests db.
      // It would probably be better to move this to db setup as it would
      // mirror prod more closely.
      await isolatedApp.get(DatabaseMigrationCommand).execute();

      // Create a webhook with a valid subscription
      const webhook = await isolatedTester.apply(
        webhooks.save({
          subscription: ProjectCreatedId,
          url: receiver.url,
          key: 'MigrationTestWebhook' as ID,
        }),
      );

      // Verify channels were initially evaluated...not really necessary
      const initialChannels = await isolatedTester.apply(
        webhooks.getChannels(webhook.id),
      );
      expect(initialChannels).toEqual(['project:created']);
      // endregion

      // region Arrange simulated application change to act upon
      // Simulate a schema version change by updating the SubscriptionChannelVersion
      const newVersion = DateTime.now();
      const newApp = await createApp({
        config: {
          // Share db with the suite app
          neo4j: isolatedApp.get(ConfigService).neo4j,
        },
        overrides: (builder) =>
          builder
            .overrideProvider(SubscriptionChannelVersion.TOKEN)
            .useValue(newVersion),
      });

      // Patch projectCreated subscription resolver to be invalid
      // This could also be a breaking change in schema
      patchMethod(newApp.get(ProjectChannels), 'created', (base) => () => {
        const channel = base();
        patchMethod(channel, 'observe', () => () => {
          throw new Error('Simulated invalid subscription resolution');
        });
        return channel;
      });
      // endregion

      // region Act
      const waitingForWebhook = firstValueFrom(events.pipe(timeout(SHORT)));

      // Call db migrate, as would happen on deployment, which should trigger webhook migration
      await newApp.get(DatabaseMigrationCommand).execute();
      // endregion

      // region Assert
      const request = await waitingForWebhook;
      expectErrorPayload(request.body);

      // Verify the webhook is marked invalid
      const newTester = await isolatedTester.move(newApp);
      const migrated = await newTester.apply(webhooks.get(webhook.key));
      expect(migrated.valid).toBe(false);
      // endregion
    });
  });
});

const ProjectCreatedId = graphql(`
  subscription ProjectCreatedId {
    projectCreated {
      project {
        id
      }
    }
  }
`);

// region Webhook Operations
type WebhookConfig = InputOf<typeof SaveDoc>;
type Webhook = FragmentOf<typeof webhookFrag>;

const webhooks = {
  save: (input: WebhookConfig) => async (tester: Tester) => {
    const res = await tester.run(SaveDoc, { input });
    return res.saveWebhook.webhook;
  },
  rotateSecret: () => async (tester: Tester) => {
    const res = await tester.run(RotateSecretDoc);
    return res.rotateWebhookSecret.secret;
  },
  list: () => async (tester: Tester) => {
    const res = await tester.run(ListDoc);
    return res.webhooks;
  },
  get: (key: string) => async (tester: Tester) => {
    const list = await tester.apply(webhooks.list());
    return list.items.find((w) => w.key === key)!;
  },
  delete: (args: VariablesOf<typeof DeleteDoc>) => async (tester: Tester) => {
    const res = await tester.run(DeleteDoc, args);
    return res.deleteWebhook.deleted;
  },
  getChannels: (webhook: ID<'Webhook'>) => (tester: Tester) =>
    tester.app.get(WebhookChannelRepository).listForWebhook(webhook),
};

const webhookFrag = graphql(`
  fragment webhook on Webhook {
    id
    key
    name

    subscription
    variables
    metadata
    url

    secret
    createdAt
    modifiedAt
    valid
  }
`);
const SaveDoc = graphql(
  `
    mutation Save($input: WebhookConfig!) {
      saveWebhook(input: $input) {
        webhook {
          ...webhook
        }
      }
    }
  `,
  [webhookFrag],
);

const RotateSecretDoc = graphql(`
  mutation RotateSecret {
    rotateWebhookSecret {
      secret
    }
  }
`);

const ListDoc = graphql(
  `
    query ListWebhooks {
      webhooks {
        items {
          ...webhook
        }
        hasMore
        total
      }
    }
  `,
  [webhookFrag],
);

const DeleteDoc = graphql(
  `
    mutation DeleteWebhook($id: ID, $key: ID, $name: String, $all: Boolean) {
      deleteWebhook(id: $id, key: $key, name: $name, all: $all) {
        deleted {
          ...webhook
        }
      }
    }
  `,
  [webhookFrag],
);
// endregion

// region Webhook HTTP Consumer Logic
const serve = async (handler: ServerAdapterRequestHandler<unknown>) => {
  const adapter = createServerAdapter(handler);

  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  const server = createServer(adapter);
  adapter.disposableStack.defer(() => promisify(server.close.bind(server))());

  await new Promise<void>((resolve) => {
    server.listen(0, () => resolve());
  });
  const addr = server.address() as AddressInfo;

  return {
    url: `http://${addr.address === '::' ? 'localhost' : addr.address}:${addr.port}`,
    async [Symbol.asyncDispose]() {
      await adapter.dispose();
    },
  };
};

type WebhookRequest = Pick<Request, 'method' | 'headers'> & { body: string };

const handleRequest =
  (events?: Subject<WebhookRequest>, response = async () => new Response()) =>
  async (req: Request) => {
    const body = await req.text();

    try {
      const json = JSON.parse(body);
      if (json.challenge) {
        return Response.json({ challenge: json.challenge });
      }
    } catch (error) {
      // Ignore, other tests will fail
    }

    events?.next({
      method: req.method,
      headers: req.headers,
      body,
    });
    return await response();
  };

type SignatureHeader = ReturnType<typeof parseSignature>;
const parseSignature = (request: WebhookRequest) =>
  mapEntries(
    request.headers.get('cord-signature')?.split(',') || [],
    (entry) => entry.split('=') as ['t' | 'v1', string],
  ).asRecord;
// endregion

function expectErrorPayload(body: string, isStillValid = false) {
  const payload = JSON.parse(body);
  expect(payload.errors).toBeDefined();
  expect(payload.errors.length).toBeGreaterThan(0);
  expect(new GqlError(payload.errors[0])).toMatchSnapshot();
  expect(payload.extensions.webhook.valid).toBe(isStillValid);
  return payload;
}
