import { registerEnumType } from '@nestjs/graphql';

export enum Sensitivity {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
}

registerEnumType(Sensitivity, {
  name: 'Sensitivity',
});

export const getHighestSensitivity = (
  sensitivityArr: Sensitivity[]
): Sensitivity | undefined => {
  if (!sensitivityArr.length) return undefined;

  const rank = {
    Low: 0,
    Medium: 1,
    High: 2,
  };

  let currentMaxSensitivity = sensitivityArr[0];
  for (const sensitivity of sensitivityArr) {
    if (rank[sensitivity] > rank[currentMaxSensitivity])
      currentMaxSensitivity = sensitivity;
  }
  return currentMaxSensitivity;
};
