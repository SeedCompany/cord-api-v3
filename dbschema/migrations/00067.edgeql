CREATE MIGRATION m1f2vgmwgreou5bz2365deujfwkgiot4xif2wpligb7efkgywb4gwq
    ONTO m1457xy4vwahulfxvplnwrlilb7k3q43344qns2kgbbrqu4eqqfeqq
{
  ALTER TYPE Scripture::Collection {
      ALTER LINK verses {
          ON SOURCE DELETE DELETE TARGET;
      };
  };
  ALTER TYPE default::DerivativeScriptureProduct {
      ALTER LINK scripture {
          DROP REWRITE
              INSERT ;
          };
          ALTER LINK scriptureOverride {
              ON SOURCE DELETE DELETE TARGET;
          };
      };
  ALTER TYPE default::Producible {
      ALTER LINK scripture {
          ON SOURCE DELETE DELETE TARGET;
      };
  };
  ALTER TYPE default::DerivativeScriptureProduct {
      ALTER LINK scripture {
          CREATE REWRITE
              INSERT 
              USING ((IF EXISTS (.scriptureOverride) THEN (IF EXISTS (.scriptureOverride.verses) THEN .scriptureOverride ELSE {}) ELSE .produces.scripture));
      };
  };
  ALTER TYPE default::DerivativeScriptureProduct {
      ALTER LINK scripture {
          DROP REWRITE
              UPDATE ;
          };
      };
  ALTER TYPE default::DerivativeScriptureProduct {
      ALTER LINK scripture {
          CREATE REWRITE
              UPDATE 
              USING ((IF EXISTS (.scriptureOverride) THEN (IF EXISTS (.scriptureOverride.verses) THEN .scriptureOverride ELSE {}) ELSE .produces.scripture));
      };
  };
  ALTER TYPE Scripture::VerseRange {
      ALTER LINK `end` {
          ON SOURCE DELETE DELETE TARGET;
      };
      ALTER LINK `start` {
          ON SOURCE DELETE DELETE TARGET;
      };
  };
  ALTER TYPE default::Product {
      ALTER LINK scripture {
          ON SOURCE DELETE DELETE TARGET;
      };
  };
  ALTER TYPE default::DerivativeScriptureProduct {
      ALTER LINK scripture {
          ON SOURCE DELETE ALLOW;
      };
      CREATE TRIGGER deleteOldScriptureOverride
          AFTER UPDATE 
          FOR EACH 
              WHEN ((__old__.scriptureOverride ?!= __new__.scriptureOverride))
          DO (DELETE
              __old__.scriptureOverride
          );
  };
  ALTER TYPE default::Producible {
      ALTER TRIGGER updateDerivativeProducts {
          WHEN ((__old__.scripture ?!= __new__.scripture));
          USING (UPDATE
              default::DerivativeScriptureProduct
          FILTER
              ((.produces = __new__) AND NOT (EXISTS (.scriptureOverride)))
          SET {
              scripture := __new__.scripture
          });
      };
  };
  ALTER TYPE default::DirectScriptureProduct {
      CREATE TRIGGER deleteOldScripture
          AFTER UPDATE 
          FOR EACH 
              WHEN ((__old__.scripture ?!= __new__.scripture))
          DO (DELETE
              __old__.scripture
          );
      ALTER LINK unspecifiedScripture {
          ON SOURCE DELETE DELETE TARGET;
      };
      CREATE TRIGGER deleteOldUnspecifiedScripture
          AFTER UPDATE 
          FOR EACH 
              WHEN ((__old__.unspecifiedScripture ?!= __new__.unspecifiedScripture))
          DO (DELETE
              __old__.unspecifiedScripture
          );
  };
  ALTER TYPE default::Location {
      CREATE LINK defaultMarketingRegion: default::Location;
  };
};
