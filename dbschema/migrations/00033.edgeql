CREATE MIGRATION m1ijgeabkfengfe2lpxjtq7xxqjiulhehay7tuutdoa5g3scsenwvq
    ONTO m1hb7zty3d4ekb5ftznc4tv4h5mgkxy6db42zbxylaw2rmrpveqsxq
{
  ALTER TYPE Project::Child {
      ALTER TRIGGER enforceCorrectProjectContext USING (std::assert((__new__.projectContext = __new__.project.projectContext), message := "Given project context must match given project's context"));
  };
};
