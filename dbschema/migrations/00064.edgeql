CREATE MIGRATION m1ffbqlhzq7s5cm4krqdkva6xq5cua6hrinyq7eq3ty2jdm7prg6sq
    ONTO m12c4p2sdcptmmojgywktqsmk5aldxgbiwn26ipq5jxs7uuwksqw2a
{
  ALTER TYPE default::Media {
      DROP LINK file;
      DROP PROPERTY altText;
      DROP PROPERTY caption;
      DROP PROPERTY mimeType;
  };
  ALTER TYPE Media::Temporal {
      DROP PROPERTY duration;
  };
  DROP TYPE Media::Audio;
  ALTER TYPE Media::Visual {
      DROP LINK dimensions;
  };
  DROP TYPE Media::Image;
  DROP TYPE Media::Video;
  DROP TYPE Media::Temporal;
  DROP TYPE Media::Visual;
  DROP TYPE default::Media;
  CREATE ABSTRACT TYPE default::Media {
      CREATE REQUIRED LINK file: File::Version {
          SET readonly := true;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE PROPERTY altText: std::str;
      CREATE PROPERTY caption: std::str;
      CREATE REQUIRED PROPERTY mimeType: std::str;
  };
  CREATE ABSTRACT TYPE Media::Temporal EXTENDING default::Media {
      CREATE REQUIRED PROPERTY duration: std::int32;
  };
  CREATE TYPE Media::Audio EXTENDING Media::Temporal;
  CREATE ABSTRACT TYPE Media::Visual EXTENDING default::Media {
      CREATE REQUIRED LINK dimensions: Media::Dimensions;
  };
  CREATE TYPE Media::Image EXTENDING Media::Visual;
  CREATE TYPE Media::Video EXTENDING Media::Visual, Media::Temporal;
};
