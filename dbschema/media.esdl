module default {
  abstract type Media {
    required file: File::Version {
      readonly := true;
      constraint exclusive;
    }

    required mimeType: str;
    
    altText: str;
    caption: str;

    access policy CanReadGeneratedFromAppPoliciesForMedia
    allow select using (
      not exists default::currentUser
        or exists (<default::Role>{'Administrator', 'Leadership'} intersect default::currentUser.roles)
    );
    access policy CanCreateGeneratedFromAppPoliciesForMedia
    allow insert using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
    );
    access policy CanDeleteGeneratedFromAppPoliciesForMedia
    allow delete using (
      not exists default::currentUser
        or default::Role.Administrator in default::currentUser.roles
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
