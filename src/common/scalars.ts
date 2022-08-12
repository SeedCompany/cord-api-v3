import { Type } from '@nestjs/common';
import { CustomScalar } from '@nestjs/graphql';
import { GraphQLScalarType } from 'graphql';
import { DateScalar, DateTimeScalar } from './luxon.graphql';
import { UrlScalar } from './url.field';

type Scalar = GraphQLScalarType | Type<CustomScalar<any, any>>;

// YOU SHOULD ADD SCALARS TO THIS LIST
export const getRegisteredScalars = (): Scalar[] => [
  DateScalar,
  DateTimeScalar,
  UrlScalar,
];
