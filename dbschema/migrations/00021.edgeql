CREATE MIGRATION m1c5l3sqykj5an6vd6jjfgzpiax2hg5mpnu5gl2jrovvrb6q2oglia
    ONTO m15a6v6vq6uagxsmifldt2bj5d2et34zxi7vzln7fuu6ehdolxl7dq
{
  CREATE ABSTRACT TYPE Engagement::Child EXTENDING Project::Child {
      CREATE REQUIRED LINK engagement: default::Engagement {
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
      };
      CREATE TRIGGER enforceEngagementProject
          AFTER UPDATE, INSERT 
          FOR EACH DO (std::assert((__new__.engagement.project = __new__.project), message := 'Given engagement must be for the same project as the given project.'));
      CREATE ANNOTATION std::description := 'A type that is a child of an engagement. It will always have a reference to a single engagement & project that it is under.';
  };
  ALTER TYPE Engagement::Ceremony {
      DROP EXTENDING Engagement::Resource;
      EXTENDING Engagement::Child LAST;
  };
  DROP TYPE Engagement::Resource;
};
