CREATE MIGRATION m1ec555emidxpj7eojvqzlxo6b4aynlblocm5mqv7xoptagjodyffq
    ONTO m1wwg76ehuufntgxnrnfhvejnb5zvc33raag4o62zud3uhoyq44rbq
{
  ALTER TYPE default::Partner {
      CREATE MULTI PROPERTY approvedPrograms: Project::Type;
  };
};
