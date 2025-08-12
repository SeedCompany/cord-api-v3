CREATE MIGRATION m1qjcnnthm42mz6jswlbbdfipbxk5zwsjyfirbgh54tmybh6gojowq
    ONTO m1lyywc5pcxyfanxv2acytadtefwklgvbscl4dpm5fnfsjivxvixea
{
  CREATE MODULE Tool IF NOT EXISTS;
  CREATE TYPE Tool::Usage EXTENDING default::Resource, Mixin::Embedded {
      ALTER LINK container {
          ON TARGET DELETE DELETE SOURCE;
          SET OWNED;
          SET REQUIRED;
          SET TYPE default::Resource;
      };
      CREATE PROPERTY startDate: std::cal::local_date;
  };
  CREATE TYPE default::Tool EXTENDING default::Resource, Mixin::Named {
      ALTER PROPERTY name {
          SET OWNED;
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE PROPERTY aiBased: std::bool {
          SET default := false;
      };
  };
  ALTER TYPE Tool::Usage {
      CREATE REQUIRED LINK tool: default::Tool;
  };
  ALTER TYPE default::Tool {
      CREATE LINK usages := (.<tool[IS Tool::Usage]);
  };
};
