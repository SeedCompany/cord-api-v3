module default {
  abstract type Media {
    required file: File::Version {
      readonly := true;
      constraint exclusive;
    }

    required mimeType: str;
    
    altText: str;
    caption: str;

    access policy CanSelectGeneratedFromAppPoliciesForMedia
    allow select using (
      exists (<default::Role>{'Administrator', 'Leadership'} intersect (<default::User>(global default::currentUserId)).roles)
    );

    access policy CanInsertGeneratedFromAppPoliciesForMedia
    allow insert using (
      default::Role.Administrator in (<default::User>(global default::currentUserId)).roles
    );

    access policy CanDeleteGeneratedFromAppPoliciesForMedia
    allow delete using (
      default::Role.Administrator in (<default::User>(global default::currentUserId)).roles
    );
  }
}

module Media {
  abstract type Visual extending default::Media {
    required dimensions: tuple<width: int16, height: int16>;
  }
  
  abstract type Temporal extending default::Media {
    required `duration`: int32;
  }
  
  type Image extending Visual {
  }
  
  type Video extending Visual, Temporal {
  }
  
  type Audio extending Temporal {
  }
}
