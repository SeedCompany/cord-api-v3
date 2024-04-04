CREATE MIGRATION m1hekmmtve36s2nqc2qtj7w5ksjeylu7hdosxcd4ddvacgpm73h5cq
    ONTO m1ffbqlhzq7s5cm4krqdkva6xq5cua6hrinyq7eq3ty2jdm7prg6sq
{
  CREATE MODULE ProgressReport::Media IF NOT EXISTS;
  CREATE TYPE ProgressReport::Media::VariantGroup;
  ALTER TYPE default::File {
      CREATE REQUIRED LINK latestVersion: File::Version {
          SET REQUIRED USING (<File::Version>{});
      };
      CREATE SINGLE LINK media := (.latestVersion.<file[IS default::Media]);
  };
  CREATE TYPE ProgressReport::Media EXTENDING ProgressReport::Child, Mixin::Owned {
      CREATE REQUIRED LINK variantGroup: ProgressReport::Media::VariantGroup;
      CREATE REQUIRED PROPERTY variant: std::str;
      CREATE CONSTRAINT std::exclusive ON ((.variantGroup, .variant));
      CREATE REQUIRED LINK file: default::File;
      CREATE REQUIRED SINGLE LINK media := (std::assert_exists(.file.media));
      CREATE TRIGGER deleteEmptyVariantGroup
          AFTER DELETE 
          FOR EACH DO (DELETE
              __old__.variantGroup
          FILTER
              NOT (EXISTS ((SELECT
                  ProgressReport::Media
              FILTER
                  (.variantGroup = __old__.variantGroup)
              )))
          );
      CREATE PROPERTY category: std::str;
  };
};
