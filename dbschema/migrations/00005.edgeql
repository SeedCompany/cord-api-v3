CREATE MIGRATION m1jmb5p3ypawyyn6yvctr5of2zp2mw5rd5iyzrxnqmn75eyp3viroq
    ONTO m1pqnnddxdh5r2mz2c2t467qes4mbrhtnttrvyejcigcxzwpjwmdka
{
  ALTER TYPE User::Unavailability {
    CREATE PROPERTY `end` := (std::assert_exists(std::range_get_upper(.dates)));
    CREATE PROPERTY `start` := (std::assert_exists(std::range_get_lower(.dates)));
  };
};
