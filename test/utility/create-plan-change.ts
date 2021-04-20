import { gql } from 'apollo-server-core';
import * as faker from 'faker';
import { isValidId } from '../../src/common';
import {
  CreatePlanChange,
  PlanChange,
} from '../../src/components/project/change-to-plan/dto';
import { PlanChangeStatus } from '../../src/components/project/change-to-plan/dto/plan-change-status.enum';
import { PlanChangeType } from '../../src/components/project/change-to-plan/dto/plan-change-type.enum';
import { TestApp } from './create-app';
import { createProject } from './create-project';
import { fragments } from './fragments';

export async function createPlanChange(
  app: TestApp,
  input: Partial<CreatePlanChange>
) {
  const planChange: CreatePlanChange = {
    projectId: input.projectId ?? (await createProject(app)).id,
    status: PlanChangeStatus.Pending,
    types: [PlanChangeType.Other],
    summary: faker.random.alpha(),
    ...input,
  };

  const result = await app.graphql.mutate(
    gql`
      mutation createPlanChange($input: CreatePlanChangeInput!) {
        createPlanChange(input: $input) {
          planChange {
            ...planChange
          }
        }
      }
      ${fragments.planChange}
    `,
    {
      input: {
        planChange,
      },
    }
  );

  const actual: PlanChange = result.createPlanChange.planChange;
  expect(actual).toBeTruthy();

  expect(isValidId(actual.id)).toBe(true);

  return actual;
}
