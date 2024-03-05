module default {
  abstract type Media {
    required file: default::File;
    required mimeType: str;
    
    altText: str;
    caption: str;
  }
}

module Media {
  type Dimensions {
    required width: int16;
    required height: int16;
  }
  
  abstract type Visual extending default::Media {
    required dimensions: Dimensions;
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
