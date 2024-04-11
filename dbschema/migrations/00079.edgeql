CREATE MIGRATION m1sfauxznuxghwg6pwtxfo5fk6azud5xl6m4fhqqboriroejwpeegq
    ONTO m1ku55m2qkjmqjhurge3iiolac7zkf76zuzrs2y7u7djghui4fhima
{
  ALTER TYPE Project::ContextAware {
      ALTER LINK projectContext {
          ON TARGET DELETE DELETE SOURCE;
      };
  };
};
