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
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        exists (<default::Role>{'Administrator', 'Leadership'} intersect givenRoles)
      )
    );

    access policy CanInsertGeneratedFromAppPoliciesForMedia
    allow insert using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        default::Role.Administrator in givenRoles
      )
    );

    access policy CanDeleteGeneratedFromAppPoliciesForMedia
    allow delete using (
      with
        givenRoles := (<default::User>(global default::currentUserId)).roles
      select (
        default::Role.Administrator in givenRoles
      )
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
