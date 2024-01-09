CREATE MIGRATION m1xzy4deu3w7kduilieoiydxysopymo7skj4sftggjen4vi3og6kaq
    ONTO m1ydhle3dwjru34saeiidf5dyepbesugdwttrvnsyxhezpme5bfqga
{
  CREATE MODULE Scripture IF NOT EXISTS;
  CREATE TYPE Scripture::Collection {
      CREATE REQUIRED PROPERTY label: std::str {
          SET readonly := true;
      };
  };
  CREATE TYPE Scripture::VerseRange {
      CREATE REQUIRED PROPERTY label: std::str {
          SET readonly := true;
      };
  };
  ALTER TYPE Scripture::Collection {
      CREATE MULTI LINK verses: Scripture::VerseRange {
          ON SOURCE DELETE DELETE TARGET IF ORPHAN;
          SET readonly := true;
      };
  };
  CREATE TYPE Scripture::Verse {
      CREATE REQUIRED PROPERTY verseId: std::int16 {
          SET readonly := true;
          CREATE CONSTRAINT std::max_value(31101);
          CREATE CONSTRAINT std::min_value(0);
      };
      CREATE REQUIRED PROPERTY book: std::str {
          SET readonly := true;
      };
      CREATE REQUIRED PROPERTY chapter: std::int16 {
          SET readonly := true;
          CREATE CONSTRAINT std::max_value(150);
          CREATE CONSTRAINT std::min_value(1);
      };
      CREATE REQUIRED PROPERTY verse: std::int16 {
          SET readonly := true;
          CREATE CONSTRAINT std::max_value(176);
          CREATE CONSTRAINT std::min_value(1);
      };
      CREATE PROPERTY label := (((((.book ++ ' ') ++ <std::str>.chapter) ++ ':') ++ <std::str>.verse));
  };
  ALTER TYPE Scripture::VerseRange {
      CREATE REQUIRED LINK `end`: Scripture::Verse {
          ON SOURCE DELETE DELETE TARGET IF ORPHAN;
          SET readonly := true;
      };
      CREATE REQUIRED LINK `start`: Scripture::Verse {
          ON SOURCE DELETE DELETE TARGET IF ORPHAN;
          SET readonly := true;
      };
      CREATE PROPERTY ids := (std::range(<std::int32>.`start`.verseId, <std::int32>.`end`.verseId, inc_upper := true));
  };
  ALTER TYPE Scripture::Collection {
      CREATE PROPERTY ids := (std::multirange(std::array_agg(.verses.ids)));
  };
  ALTER TYPE default::Producible {
      CREATE LINK scripture: Scripture::Collection {
          ON SOURCE DELETE DELETE TARGET IF ORPHAN;
      };
      CREATE TRIGGER denyEmptyScriptureCollection
          AFTER UPDATE, INSERT 
          FOR EACH DO (std::assert(EXISTS (__new__.scripture.verses), message := '`Producible.scripture` should have a `Scripture::Collection` with verses or be null/empty-set'));
  };
  ALTER TYPE default::Producible {
      DROP PROPERTY scriptureReferences;
  };
};
