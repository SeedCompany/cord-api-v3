CREATE MIGRATION m15a6v6vq6uagxsmifldt2bj5d2et34zxi7vzln7fuu6ehdolxl7dq
    ONTO m16iocvtxxrlcx2ireyxh66ma6ti5tpi3hr7jga2lnfjvoi2nez3ha
{
  CREATE ABSTRACT TYPE Project::Child EXTENDING default::Resource, Project::ContextAware {
      CREATE REQUIRED LINK project: default::Project {
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
      };
      CREATE TRIGGER enforceCorrectProjectContext
          AFTER UPDATE, INSERT 
          FOR EACH DO (std::assert((__new__.project IN __new__.projectContext.projects), message := 'Given project must be in given project context'));
      CREATE ANNOTATION std::description := 'A type that is a child of a project. It will always have a reference to a single project that it is under.';
  };
  ALTER TYPE Engagement::Resource {
      DROP EXTENDING Project::Resource;
      EXTENDING Project::Child LAST;
  };
  ALTER TYPE Project::Member {
      DROP EXTENDING Project::Resource;
      EXTENDING Project::Child LAST;
  };
  ALTER TYPE default::Engagement {
      DROP EXTENDING Project::Resource;
      EXTENDING Project::Child LAST;
  };
  DROP TYPE Project::Resource;
};
