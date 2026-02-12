import { type Type } from '@nestjs/common';
import { type CustomScalar } from '@nestjs/graphql';
import { type GraphQLScalarType } from 'graphql';
import { FileUploadScalar } from './file-upload.scalar';
import { InlineMarkdownScalar, MarkdownScalar } from './markdown.scalar';
import { RichTextScalar } from './rich-text.scalar';
import { DateScalar, DateTimeScalar } from './temporal.scalar';
import { UrlScalar } from './url.scalar';

export * from './file-upload.scalar';
export * from './temporal.scalar';
export * from './markdown.scalar';
export * from './rich-text.scalar';

type Scalar = GraphQLScalarType | Type<CustomScalar<any, any>>;

// YOU SHOULD ADD SCALARS TO THIS LIST
export const getRegisteredScalars = (): Scalar[] => [
  DateScalar,
  DateTimeScalar,
  RichTextScalar,
  FileUploadScalar,
  UrlScalar,
  MarkdownScalar,
  InlineMarkdownScalar,
];
