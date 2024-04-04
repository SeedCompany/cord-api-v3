CREATE MIGRATION m1shta7vgmvlfcofj5wxkhkzx7lzarwzs6mzd63kenlksmrfgsemaa
    ONTO m1efouys27dm25xlcev2h2neozm4evdaskchj2jqjhvqjm5g5i6tkq
{
  CREATE MODULE Media IF NOT EXISTS;
  CREATE ABSTRACT TYPE default::Media {
      CREATE REQUIRED LINK file: default::File;
      CREATE PROPERTY altText: std::str;
      CREATE PROPERTY caption: std::str;
      CREATE REQUIRED PROPERTY mimeType: std::str;
  };
  CREATE ABSTRACT TYPE Media::Temporal EXTENDING default::Media {
      CREATE REQUIRED PROPERTY duration: std::int32;
  };
  CREATE TYPE Media::Audio EXTENDING Media::Temporal;
  CREATE TYPE Media::Dimensions {
      CREATE REQUIRED PROPERTY height: std::int16;
      CREATE REQUIRED PROPERTY width: std::int16;
  };
  CREATE ABSTRACT TYPE Media::Visual EXTENDING default::Media {
      CREATE REQUIRED LINK dimensions: Media::Dimensions;
  };
  CREATE TYPE Media::Image EXTENDING Media::Visual;
  CREATE TYPE Media::Video EXTENDING Media::Visual, Media::Temporal;
};
