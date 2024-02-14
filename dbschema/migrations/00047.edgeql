CREATE MIGRATION m1ah6i4a5c6enkrmypo7k3y6f3flr26mqlqtkw2t6437evoxqqzpna
    ONTO m1bh4xyugmqj3aeh2pujkbly6uq7lxdisxwdodawgw2flyvbxfnkkq
{
  ALTER TYPE Project::ContextAware {
      CREATE REQUIRED SINGLE PROPERTY sensitivity := ((std::max(.projectContext.projects.ownSensitivity) ?? (.ownSensitivity ?? default::Sensitivity.High)));
  };
  ALTER TYPE default::Post {
      CREATE SINGLE PROPERTY sensitivity := (.container[IS Project::ContextAware].sensitivity);
  };
};
