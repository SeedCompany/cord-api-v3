CREATE MIGRATION m1tgd6yl63z2bp7ahtbi7sidb5gfl7mjs47ooqfbnuleffpap3auua
    ONTO m1vlgekf4eyzweb6xmldmxwzohoh7xbrre6fbc7e2d3t7q7ry3qobq
{
  CREATE TYPE default::Alias {
      CREATE REQUIRED LINK target: std::Object {
          ON TARGET DELETE DELETE SOURCE;
      };
      CREATE REQUIRED PROPERTY name: std::str {
          CREATE CONSTRAINT std::exclusive;
      };
  };
};
