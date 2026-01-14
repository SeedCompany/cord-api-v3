import { expect } from '@jest/globals';
import { type ID } from '~/common';
import { graphql, type VariablesOf } from '~/graphql';
import { type TestApp } from './create-app';
import { getCurrentEngagementStatus } from './create-engagement';
import { createFundingAccount } from './create-funding-account';
import { createLocation } from './create-location';
import { createRegion } from './create-region';
import * as fragments from './fragments';
import { runAsAdmin } from './login';
import {
  changeProjectStep,
  stepsFromEarlyConversationToBeforeActive,
} from './transition-project';
import { updateProject } from './update-project';

export const changeInternshipEngagementStatus = async (
  app: TestApp,
  id: ID,
  to: VariablesOf<typeof ChangeInternshipEngStatusDoc>['status'],
) => {
  const result = await app.graphql.mutate(ChangeInternshipEngStatusDoc, {
    id,
    status: to,
  });
  return result.updateInternshipEngagement.engagement;
};
const ChangeInternshipEngStatusDoc = graphql(
  `
    mutation ChangeInternshipEngagementStatus(
      $id: ID!
      $status: EngagementStatus!
    ) {
      updateInternshipEngagement(
        input: { engagement: { id: $id, status: $status } }
      ) {
        engagement {
          ...internshipEngagement
        }
      }
    }
  `,
  [fragments.internshipEngagement],
);

export const changeLanguageEngagementStatus = async (
  app: TestApp,
  id: ID,
  to: VariablesOf<typeof ChangeLangEngStatusDoc>['status'],
) => {
  const result = await app.graphql.mutate(ChangeLangEngStatusDoc, {
    id,
    status: to,
  });
  expect(result.updateLanguageEngagement.engagement.status.value).toBe(to);
  return result.updateLanguageEngagement.engagement;
};
const ChangeLangEngStatusDoc = graphql(
  `
    mutation ChangeLanguageEngagementStatus(
      $id: ID!
      $status: EngagementStatus!
    ) {
      updateLanguageEngagement(
        input: { engagement: { id: $id, status: $status } }
      ) {
        engagement {
          ...languageEngagement
        }
      }
    }
  `,
  [fragments.languageEngagement],
);

export const transitionEngagementToActive = async (
  app: TestApp,
  projectId: ID,
  langEngagementId: ID,
) => {
  await runAsAdmin(app, async () => {
    const fundingAccount = await createFundingAccount(app);
    const location = await createLocation(app, {
      fundingAccountId: fundingAccount.id,
    });
    const fieldRegion = await createRegion(app);
    await updateProject(app, {
      id: projectId,
      primaryLocationId: location.id,
      fieldRegionId: fieldRegion.id,
    });
    for (const next of stepsFromEarlyConversationToBeforeActive) {
      await changeProjectStep(app, projectId, next);
    }
    await changeProjectStep(app, projectId, 'Active');
  });
  const lEngagementStatus = await getCurrentEngagementStatus(
    app,
    langEngagementId,
  );
  expect(lEngagementStatus.status.value).toBe('Active');
  return lEngagementStatus;
};
