import {
  Field,
  Float,
  InputType,
  Int,
  InterfaceType,
  ObjectType,
} from '@nestjs/graphql';
import { simpleSwitch } from '@seedcompany/common';
import { stripIndent } from 'common-tags';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  DataObject,
  DbLabel,
  ID,
  IdField,
  IdOf,
  IntersectTypes,
  NameField,
  SecuredProps,
  ServerException,
} from '~/common';
import { BaseNode } from '~/core/database/results';
import { e } from '~/core/gel';
import { RegisterResource } from '~/core/resources';
import { FileVersion } from '../dto';

export type AnyMedia = Image | Video | Audio;

export const resolveMedia = (val: Pick<AnyMedia, '__typename'>) => {
  const type = simpleSwitch(val.__typename, { Image, Video, Audio });
  if (!type) {
    throw new ServerException('Could not resolve media type');
  }
  return type;
};

@InputType()
@InterfaceType({ isAbstract: true })
@ObjectType({ isAbstract: true })
@DbLabel(null)
export class MediaUserMetadata extends DataObject {
  static readonly Props: string[] = keysOf<MediaUserMetadata>();

  @NameField({
    description: stripIndent`
      A description of this media for accessibility, especially for screen readers.
      It should convey this media's content and function.

      Example:
        A beautiful sunset over a serene lake with silhouettes of trees.
    `,
    nullable: true,
  })
  readonly altText?: string | null;

  @NameField({
    description: stripIndent`
      A title or brief explanation accompanying this media.
      It could add information that the media does not directly convey.

      Example:
        Sunset over Lake Serenity, where locals come to relax and enjoy the view.
    `,
    nullable: true,
  })
  readonly caption?: string | null;
}

@InterfaceType({
  resolveType: resolveMedia,
})
@RegisterResource({ db: e.Media })
export class Media extends MediaUserMetadata {
  static readonly Props: string[] = keysOf<Media>();
  static readonly SecuredProps: string[] = keysOf<SecuredProps<Media>>();

  declare __typename: unknown;

  @IdField()
  readonly id: ID;

  readonly file: IdOf<FileVersion>;

  /** The resource that holds the root file node that this media is attached to */
  readonly attachedTo: [resource: BaseNode, relation: string];

  @Field(() => String)
  readonly mimeType: string;
}

@ObjectType()
export class Dimensions extends DataObject {
  @Field(() => Int)
  readonly width: number;

  @Field(() => Int)
  readonly height: number;
}

@InterfaceType({ implements: [Media] })
export class VisualMedia extends Media {
  declare __typename: 'Image' | 'Video';

  @Field(() => Dimensions)
  readonly dimensions: Dimensions;
}

@InterfaceType({ implements: [Media] })
export class TemporalMedia extends Media {
  declare __typename: 'Video' | 'Audio';

  @Field(() => Float)
  readonly duration: number;
}

@ObjectType({
  implements: [VisualMedia, Media],
})
export class Image extends VisualMedia {
  static readonly Props = keysOf<Image>();
  static readonly SecuredProps = keysOf<SecuredProps<Image>>();

  declare __typename: 'Image';
}

@ObjectType({
  implements: [VisualMedia, TemporalMedia, Media],
})
export class Video extends IntersectTypes(VisualMedia, TemporalMedia) {
  static readonly Props = keysOf<Video>();
  static readonly SecuredProps = keysOf<SecuredProps<Video>>();

  declare __typename: 'Video';
}

@ObjectType({
  implements: [TemporalMedia, Media],
})
export class Audio extends TemporalMedia {
  static readonly Props = keysOf<Audio>();
  static readonly SecuredProps = keysOf<SecuredProps<Audio>>();

  declare __typename: 'Audio';
}

declare module '~/core/resources/map' {
  interface ResourceMap {
    Media: typeof Media;
  }
  interface ResourceDBMap {
    Media: typeof e.default.Media;
  }
}
