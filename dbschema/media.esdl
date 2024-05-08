module default {
  abstract type Media {
    required file: File::Version {
      readonly := true;
      constraint exclusive;
    }

    required mimeType: str;
    
    altText: str;
    caption: str;

    access policy CanSelectUpdateReadGeneratedFromAppPoliciesForMedia
    allow select, update read using (
      exists (<Role>{'Administrator', 'Leadership'} intersect global currentRoles)
    );

    access policy CanUpdateWriteGeneratedFromAppPoliciesForMedia
    allow update write;

    access policy CanInsertDeleteGeneratedFromAppPoliciesForMedia
    allow insert, delete using (
      Role.Administrator in global currentRoles
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
