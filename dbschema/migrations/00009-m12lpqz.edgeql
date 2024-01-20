CREATE MIGRATION m12lpqzjxso43uktgumnjm3ggvrd5nk7wcog3ct4cp4ttdgyxlglya
    ONTO m1gq2hsptfudyqzcqhaz3o5ikdckynzcdegdixqtrdtnisldpyqv6a
{
  ALTER TYPE File::Node {
      CREATE LINK container: default::Resource {
          ON TARGET DELETE DELETE SOURCE;
          SET REQUIRED USING (std::assert_exists((SELECT
              default::Resource 
          LIMIT
              1
          )));
      };
      EXTENDING Mixin::Embedded LAST;
      CREATE MULTI LINK children: File::Node {
          ON SOURCE DELETE DELETE TARGET;
          ON TARGET DELETE ALLOW;
      };
      CREATE PROPERTY descendantIds: array<std::uuid>;
      CREATE LINK descendants := (std::assert_distinct(<File::Node>std::array_unpack(.descendantIds)));
      ALTER LINK parent {
          USING (std::assert_single(.<children[IS File::Node]));
          SET SINGLE;
      };
      CREATE PROPERTY parentIds: array<std::uuid>;
      ALTER LINK parents {
          USING (std::assert_distinct(<File::Node>std::array_unpack(.parentIds)));
          RESET CARDINALITY;
      };
      CREATE LINK root: File::Node;
  };
  ALTER TYPE File::Node {
      ALTER LINK container {
          RESET OPTIONALITY;
          RESET TYPE;
      };
      ALTER LINK parents {
          DROP PROPERTY depth;
      };
      ALTER LINK root {
          CREATE REWRITE
              INSERT 
              USING (<File::Node>std::array_get(.parentIds, -1));
          CREATE REWRITE
              UPDATE 
              USING (<File::Node>std::array_get(.parentIds, -1));
      };
      ALTER PROPERTY descendantIds {
          CREATE REWRITE
              INSERT 
              USING (WITH
                  c := 
                      (SELECT
                          (((((((((.children UNION .children.children) UNION .children.children.children) UNION .children.children.children.children) UNION .children.children.children.children.children) UNION .children.children.children.children.children.children) UNION .children.children.children.children.children.children.children) UNION .children.children.children.children.children.children.children.children) UNION .children.children.children.children.children.children.children.children.children) UNION .children.children.children.children.children.children.children.children.children.children)
                      )
              SELECT
                  std::array_agg(c.id)
              );
          CREATE REWRITE
              UPDATE 
              USING (WITH
                  c := 
                      (SELECT
                          (((((((((.children UNION .children.children) UNION .children.children.children) UNION .children.children.children.children) UNION .children.children.children.children.children) UNION .children.children.children.children.children.children) UNION .children.children.children.children.children.children.children) UNION .children.children.children.children.children.children.children.children) UNION .children.children.children.children.children.children.children.children.children) UNION .children.children.children.children.children.children.children.children.children.children)
                      )
              SELECT
                  std::array_agg(c.id)
              );
      };
      ALTER PROPERTY parentIds {
          CREATE REWRITE
              INSERT 
              USING (WITH
                  p := 
                      (SELECT
                          (((((((((.parent UNION .parent.parent) UNION .parent.parent.parent) UNION .parent.parent.parent.parent) UNION .parent.parent.parent.parent.parent) UNION .parent.parent.parent.parent.parent.parent) UNION .parent.parent.parent.parent.parent.parent.parent) UNION .parent.parent.parent.parent.parent.parent.parent.parent) UNION .parent.parent.parent.parent.parent.parent.parent.parent.parent) UNION .parent.parent.parent.parent.parent.parent.parent.parent.parent.parent)
                      )
              SELECT
                  std::array_agg(p.id)
              );
          CREATE REWRITE
              UPDATE 
              USING (WITH
                  p := 
                      (SELECT
                          (((((((((.parent UNION .parent.parent) UNION .parent.parent.parent) UNION .parent.parent.parent.parent) UNION .parent.parent.parent.parent.parent) UNION .parent.parent.parent.parent.parent.parent) UNION .parent.parent.parent.parent.parent.parent.parent) UNION .parent.parent.parent.parent.parent.parent.parent.parent) UNION .parent.parent.parent.parent.parent.parent.parent.parent.parent) UNION .parent.parent.parent.parent.parent.parent.parent.parent.parent.parent)
                      )
              SELECT
                  std::array_agg(p.id)
              );
      };
      ALTER PROPERTY size {
          SET default := 0;
      };
      CREATE TRIGGER enforceUniqueNameWithinDirectory
          AFTER UPDATE, INSERT 
          FOR EACH DO (std::assert(((__new__.parent IS default::Directory) AND (std::count((SELECT
              __new__.parent.children
          FILTER
              (.name = __new__.name)
          )) <= 1)), message := (((('Directory (' ++ <std::str>__new__.parent.id) ++ ') already has a node with this name "') ++ __new__.name) ++ '".')));
  };
  ALTER TYPE File::Version {
      ALTER PROPERTY size {
          CREATE CONSTRAINT std::expression ON ((__subject__ > 0));
          SET OWNED;
      };
      CREATE ANNOTATION std::description := 'An immutable version of a "file" backed by an actual file in storage.';
      CREATE INDEX ON (.createdAt);
      ALTER PROPERTY mimeType {
          SET readonly := true;
      };
      CREATE TRIGGER enforceImmutable
          AFTER UPDATE 
          FOR EACH DO (std::assert((__old__.size = __new__.size), message := 'File Versions are immutable.'));
      CREATE REQUIRED PROPERTY storageId: std::str {
          SET REQUIRED USING ('');
          CREATE ANNOTATION std::description := 'The id/path of this file in our storage (S3 Bucket).';
      };
      CREATE TRIGGER enforceLeafNode
          AFTER UPDATE, INSERT 
          FOR EACH DO (std::assert((std::count(__new__.children) = 0), message := 'File Versions are leaf nodes and cannot have children.'));
  };
  ALTER TYPE default::Directory {
      CREATE ANNOTATION std::description := "A directory as you'd expect in a filesystem.\n    ";
      ALTER PROPERTY size {
          SET OWNED;
          CREATE REWRITE
              INSERT 
              USING (std::sum(.descendants[IS default::File].size));
          CREATE REWRITE
              UPDATE 
              USING (std::sum(.descendants[IS default::File].size));
      };
      ALTER PROPERTY totalFiles {
          CREATE REWRITE
              INSERT 
              USING (std::count(.descendants[IS default::File]));
          CREATE REWRITE
              UPDATE 
              USING (std::count(.descendants[IS default::File]));
      };
  };
  ALTER TYPE default::File {
      CREATE ANNOTATION std::description := 'A "file" like you\'d expect in a filesystem.\n      But, here it\'s actually just a container for `File::Version`s, and fronts the info of the latest version.\n      These are mutable in the sense that new versions can be added.\n      There are no actual files stored with this directly, only with file versions.\n    ';
      ALTER LINK latestVersion {
          CREATE REWRITE
              INSERT 
              USING (SELECT
                  .children[IS File::Version] ORDER BY
                      .createdAt DESC
              LIMIT
                  1
              );
          CREATE REWRITE
              UPDATE 
              USING (SELECT
                  .children[IS File::Version] ORDER BY
                      .createdAt DESC
              LIMIT
                  1
              );
      };
      ALTER PROPERTY mimeType {
          CREATE REWRITE
              INSERT 
              USING (.latestVersion.mimeType);
          CREATE REWRITE
              UPDATE 
              USING (.latestVersion.mimeType);
          RESET OPTIONALITY;
      };
      ALTER PROPERTY size {
          SET OWNED;
          CREATE REWRITE
              INSERT 
              USING ((.latestVersion.size ?? 0));
          CREATE REWRITE
              UPDATE 
              USING ((.latestVersion.size ?? 0));
      };
  };
};
