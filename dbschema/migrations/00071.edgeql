CREATE MIGRATION m1gb5s7btpy76oedup56hbchk5exrtz6x74bs6hhzfkzkc5htinl4q
    ONTO m1dxwenx3me4w6ho2egcvovzzyqpcbibk4y2iro7ybed3i3v5utcyq
{
  ALTER TYPE Engagement::Ceremony {
      DROP TRIGGER prohibitDelete;
  };
  ALTER TYPE Scripture::Collection {
      ALTER LINK verses {
          ON TARGET DELETE DEFERRED RESTRICT;
      };
  };
  ALTER TYPE default::Project {
      ALTER LINK projectContext {
          ON SOURCE DELETE DELETE TARGET;
      };
      DROP TRIGGER enforceContext;
  };
  ALTER TYPE default::Language {
      ALTER LINK projectContext {
          ON SOURCE DELETE DELETE TARGET;
      };
  };
  ALTER TYPE default::Organization {
      ALTER LINK projectContext {
          SET default := (INSERT
              Project::Context
          );
          ON SOURCE DELETE DELETE TARGET;
          SET OWNED;
          SET TYPE Project::Context;
      };
  };
  ALTER TYPE default::Partner {
      ALTER LINK organization {
          ON SOURCE DELETE DELETE TARGET;
          ON TARGET DELETE DELETE SOURCE;
      };
  };
};
