CREATE MIGRATION m1ud7t6egltmyyxi7xts3rea6bkapucm6qx7araq7eedpoee3ujyba
    ONTO m17rl5lo5wwq63duwmpqjtdqfuhq3luocyigofuobamdcu6l4dlepq
{
  ALTER TYPE default::Partner {
      CREATE LINK parent: default::Partner {
          CREATE CONSTRAINT std::exclusive;
      };
      CREATE MULTI LINK strategicAlliances: default::Partner {
          CREATE CONSTRAINT std::exclusive;
      };
  };
};
