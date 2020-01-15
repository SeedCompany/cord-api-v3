import { registerEnumType } from 'type-graphql';

export enum Degree {
  Primary = 'primary',
  Secondary = 'secondary',
  Associates = 'associates',
  Bachelors = 'bachelors',
  Masters = 'masters',
  Doctorate = 'doctorate',
}

registerEnumType(Degree, { name: 'Degree' });
