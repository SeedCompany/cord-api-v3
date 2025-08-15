CREATE MIGRATION m1lvqi2cqin5vxdmg6o7ru557hntzlcdancr62oks5b6w72ftk5cqq
    ONTO m1lyywc5pcxyfanxv2acytadtefwklgvbscl4dpm5fnfsjivxvixea
{
  CREATE TYPE default::Tool EXTENDING default::Resource, Mixin::Named {
    ALTER PROPERTY name {
      SET OWNED;
      CREATE CONSTRAINT std::exclusive;
    };
    CREATE PROPERTY aiBased: std::bool {
      SET REQUIRED;
      SET default := false;
    };
    CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForTool
      ALLOW SELECT, UPDATE READ;
  };
  CREATE MODULE Tool IF NOT EXISTS;
  CREATE TYPE Tool::Usage EXTENDING default::Resource, Mixin::Embedded {
    CREATE REQUIRED LINK tool: default::Tool;
    ALTER LINK container {
      ON TARGET DELETE DELETE SOURCE;
      SET OWNED;
      SET REQUIRED;
      SET TYPE default::Resource;
    };
    CREATE CONSTRAINT std::exclusive ON ((.tool, .container));
    CREATE PROPERTY startDate: std::cal::local_date;
    CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForToolUsage
      ALLOW DELETE, INSERT USING (
        WITH isMember := (.container[IS Project::ContextAware].isMember ?? false)
        SELECT (
          (default::Role.FieldOperationsDirector IN GLOBAL default::currentRoles) OR (EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND isMember)
        )
      );
    CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForToolUsage
      ALLOW SELECT, UPDATE READ USING (
        WITH isMember := (.container[IS Project::ContextAware].isMember ?? false)
        SELECT (
          (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager'} INTERSECT GLOBAL default::currentRoles)) AND isMember) OR EXISTS ((<default::Role>{'FieldOperationsDirector', 'ProjectManager', 'RegionalDirector'} INTERSECT GLOBAL default::currentRoles))
        )
      );
  };
  ALTER TYPE default::Resource {
    CREATE LINK tools := (.<container[IS Tool::Usage]);
  };
  ALTER TYPE default::Tool {
    CREATE LINK usages := (.<tool[IS Tool::Usage]);
  };
};
