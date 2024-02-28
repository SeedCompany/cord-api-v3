module default {
  type Image extending Media::VisualMedia {
    overloaded _type: Media::Type {
      constraint expression on (__subject__ = Media::Type.Image)
    }
  }
  
  type Video extending Media::VisualMedia, Media::TemporalMedia {
    overloaded _type: Media::Type {
      constraint expression on (__subject__ = Media::Type.Video)
    }
  }
  
  type Audio extending Media::TemporalMedia {
    overloaded _type: Media::Type {
      constraint expression on (__subject__ = Media::Type.Audio)
    }
  }
}


module Media {
  scalar type Type extending enum<
    Image,
    Video,
    Audio
  >;
  
  abstract type MediaBase extending default::Resource {
    _type: Type;

    file: default::File;
    
    altText: str;
    caption: str;
    mimeType: str;
  }

  type Dimensions {
    required width: int16;
    required height: int16;
  }
  
  type VisualMedia extending MediaBase {
    dimensions: Dimensions;

    overloaded _type: Type {
      constraint expression on (__subject__ = Type.Image or __subject__ = Type.Video)
    }
  }
  
  type TemporalMedia extending MediaBase {
    `duration`: int32;

    overloaded _type: Type {
      constraint expression on (__subject__ = Type.Audio or __subject__ = Type.Video)
    }
  }
}
