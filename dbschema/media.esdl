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
        givenRoles := (<User>(global currentUserId)).roles
      select (
        exists (<Role>{'Administrator', 'Leadership'} intersect givenRoles)
      )
    );

    access policy CanInsertDeleteGeneratedFromAppPoliciesForMedia
    allow insert, delete using (
      with
        givenRoles := (<User>(global currentUserId)).roles
      select (
        Role.Administrator in givenRoles
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
