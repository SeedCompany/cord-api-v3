CREATE MIGRATION m1f6w2tfwomhiwhtzwnpraqfo24x3rnfcpnntt7nxe5f5l7utyjzpa
    ONTO m1t7atw76jdjhcnrngoj5euzbz7qxve7dokvbhh4x5333yxm5klkwa
{
  CREATE MODULE Budget IF NOT EXISTS;
  CREATE TYPE Budget::Record EXTENDING Project::Child {
      CREATE REQUIRED LINK organization: default::Organization {
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
      };
      CREATE REQUIRED PROPERTY fiscalYear: std::int16 {
          SET readonly := true;
      };
      CREATE PROPERTY amount: std::float32;
  };
  CREATE SCALAR TYPE Budget::Status EXTENDING enum<Pending, Current, Superceded, Rejected>;
  CREATE TYPE default::Budget EXTENDING Project::Child {
      CREATE LINK universalTemplate: default::File;
      CREATE REQUIRED PROPERTY status: Budget::Status {
          SET default := (Budget::Status.Pending);
      };
  };
  ALTER TYPE Budget::Record {
      CREATE REQUIRED LINK budget: default::Budget {
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
      };
      CREATE CONSTRAINT std::exclusive ON ((.budget, .fiscalYear, .organization));
  };
  ALTER TYPE default::Budget {
      CREATE LINK records := (.<budget[IS Budget::Record]);
  };
  ALTER TYPE default::Project {
      CREATE TRIGGER createBudgetOnInsert
          AFTER INSERT 
          FOR EACH DO (INSERT
              default::Budget
              {
                  createdAt := std::datetime_of_statement(),
                  project := __new__,
                  projectContext := __new__.projectContext
              });
  };
};
