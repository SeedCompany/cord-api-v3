import { ObjectType } from '@nestjs/graphql';
import { type RichTextDocument } from '~/common/features/rich-text';
import { RichTextScalar } from '~/common/scalars';
import { SecuredProperty } from '../abstracts/secured-property';

@ObjectType({
  description: SecuredProperty.descriptionFor('a rich text document'),
})
export abstract class SecuredRichText extends SecuredProperty<
  typeof RichTextScalar,
  RichTextDocument
>(RichTextScalar) {}

@ObjectType({
  description: SecuredProperty.descriptionFor('a rich text document or null'),
})
export abstract class SecuredRichTextNullable extends SecuredProperty<
  typeof RichTextScalar,
  RichTextDocument,
  true
>(RichTextScalar, {
  nullable: true,
}) {}
