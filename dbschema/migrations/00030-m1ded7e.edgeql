CREATE MIGRATION m1ded7eefz3g2wv23gyw6izmawdnbqfiulwqhtmcgfc3yrnv3dgaba
    ONTO m1stuiewjnhrznhwslwjqll7jd3rattughkehe3krd4oegtezhclka
{
  CREATE TYPE Notification::Preference {
    CREATE REQUIRED LINK user: default::User {
      ON TARGET DELETE DELETE SOURCE;
    };
    CREATE REQUIRED PROPERTY channel: std::str;
    CREATE REQUIRED PROPERTY notificationType: std::str;
    CREATE CONSTRAINT std::exclusive ON ((.user, .notificationType, .channel));
    CREATE REQUIRED PROPERTY enabled: std::bool;
  };
};
