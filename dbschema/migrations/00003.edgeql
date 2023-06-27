CREATE MIGRATION m1i5xxrzlqttad2poopmmfzevp4wib72p64xoqxexz5j2rlxhlxyga
    ONTO m1zdmmvwxtqsw7qjc3o2rjwtlzjpzvy44rouzt5iii5b4ifvfieoha
{
  CREATE MODULE Auth IF NOT EXISTS;
  CREATE TYPE Auth::EmailToken EXTENDING default::Resource {
      CREATE REQUIRED PROPERTY email: std::str;
      CREATE INDEX ON (.email);
      CREATE REQUIRED PROPERTY token: std::str {
          CREATE CONSTRAINT std::exclusive;
      };
  };
  CREATE TYPE Auth::Identity {
      CREATE REQUIRED LINK user: default::User {
          ON TARGET DELETE DELETE SOURCE;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE REQUIRED PROPERTY passwordHash: std::str;
  };
  CREATE TYPE Auth::Session EXTENDING default::Resource {
      CREATE LINK user: default::User {
          ON TARGET DELETE DELETE SOURCE;
      };
      CREATE REQUIRED PROPERTY token: std::str {
          CREATE CONSTRAINT std::exclusive;
      };
  };
};
