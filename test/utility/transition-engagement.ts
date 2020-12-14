import { gql } from 'apollo-server-core';
import { fragments, TestApp } from '.';
import {
  EngagementStatus,
  InternshipEngagement,
} from '../../src/components/engagement';

export const changeInternshipEngagementStatus = async (
  app: TestApp,
  id: string,
  to: EngagementStatus
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
    }
  );
  return result.updateInternshipEngagement.engagement;
};
