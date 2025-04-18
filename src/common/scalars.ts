import { Type } from '@nestjs/common';
import { CustomScalar } from '@nestjs/graphql';
import { GraphQLScalarType } from 'graphql';
import { FileUploadScalar } from './file-upload.scalar';
import { DateScalar, DateTimeScalar } from './luxon.graphql';
import { InlineMarkdownScalar, MarkdownScalar } from './markdown.scalar';
import { RichTextScalar } from './rich-text.scalar';
import { UrlScalar } from './url.field';

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
