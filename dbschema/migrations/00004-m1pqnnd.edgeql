CREATE MIGRATION m1pqnnddxdh5r2mz2c2t467qes4mbrhtnttrvyejcigcxzwpjwmdka
    ONTO m1nrdwc3vdx7w2iui6bxlxxe3urjirypmaw5ft33yehtq33dgeyovq
{
  ALTER TYPE User::Unavailability {
    ALTER PROPERTY dates {
      SET TYPE range<std::datetime> USING ( 
        std::range(
          std::to_datetime(<cal::local_datetime>std::range_get_lower(.dates), 'America/Chicago'),
          std::to_datetime(<cal::local_datetime>std::range_get_upper(.dates), 'America/Chicago')
        )
      );
    };
  };
  ALTER TYPE default::Language {
    CREATE MULTI LINK locations: default::Location;
  };
  ALTER TYPE default::Organization {
    CREATE MULTI LINK locations: default::Location;
  };
  ALTER TYPE default::User {
    ALTER LINK education {
      ON SOURCE DELETE DELETE TARGET;
    };
    CREATE MULTI LINK locations: default::Location;
    ALTER LINK unavailabilities {
      ON SOURCE DELETE DELETE TARGET;
    };
  };
};
