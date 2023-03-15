import { ID } from '~/common';
import {
  EngagementStatus,
  InternshipEngagement,
  LanguageEngagement,
} from '../../src/components/engagement';
import { ProjectStep } from '../../src/components/project';
import { TestApp } from './create-app';
import { getCurrentEngagementStatus } from './create-engagement';
import { createFundingAccount } from './create-funding-account';
import { createLocation } from './create-location';
import { createRegion } from './create-region';
import { fragments } from './fragments';
import { gql } from './gql-tag';
import { runAsAdmin } from './login';
import {
  changeProjectStep,
  stepsFromEarlyConversationToBeforeActive,
} from './transition-project';
import { updateProject } from './update-project';

export const changeInternshipEngagementStatus = async (
  app: TestApp,
  id: ID,
  to: EngagementStatus,
): Promise<InternshipEngagement> => {
  const result = await app.graphql.mutate(
    gql`
      mutation updateInternshipEngagement(
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
      ${fragments.internshipEngagement}
    `,
    {
      id,
      status: to,
    },
  );
  return result.updateInternshipEngagement.engagement;
};

export const changeLanguageEngagementStatus = async (
  app: TestApp,
  id: ID,
  to: EngagementStatus,
): Promise<LanguageEngagement> => {
  const result = await app.graphql.mutate(
    gql`
      mutation updateLanguageEngagement($id: ID!, $status: EngagementStatus!) {
        updateLanguageEngagement(
          input: { engagement: { id: $id, status: $status } }
        ) {
          engagement {
            ...languageEngagement
          }
        }
      }
      ${fragments.languageEngagement}
    `,
    {
      id,
      status: to,
    },
  );
  expect(result.updateLanguageEngagement.engagement.status.value).toBe(to);
  return result.updateLanguageEngagement.engagement;
};

export const transitionEngagementToActive = async (
  app: TestApp,
  projectId: ID,
  langEngagementId: ID,
): Promise<any> => {
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
    await changeProjectStep(app, projectId, ProjectStep.Active);
  });
  const lEngagementStatus = await getCurrentEngagementStatus(
    app,
    langEngagementId,
  );
  expect(lEngagementStatus.status.value).toBe(EngagementStatus.Active);
  return lEngagementStatus;
};
