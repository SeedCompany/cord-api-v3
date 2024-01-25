CREATE MIGRATION m1tn7o5vizqaygjvghqysxzw6ruf4xohudb2usgfg4z622ens24mba
    ONTO m1ah6i4a5c6enkrmypo7k3y6f3flr26mqlqtkw2t6437evoxqqzpna
{
  ALTER TYPE default::Project {
      ALTER PROPERTY departmentId {
          CREATE REWRITE
              UPDATE 
              USING ((IF ((NOT (EXISTS (.departmentId)) AND (.status <= Project::Status.Active)) AND (.step >= Project::Step.PendingFinanceConfirmation)) THEN (WITH
                  fa := 
                      std::assert_exists(__subject__.primaryLocation.fundingAccount, message := 'Project must have a primary location')
                  ,
                  existing := 
                      (SELECT
                          (DETACHED default::Project).departmentId
                      FILTER
                          (default::Project.primaryLocation.fundingAccount = fa)
                      )
                  ,
                  available := 
                      (std::range_unpack(std::range(((fa.accountNumber * 10000) + 11), ((fa.accountNumber * 10000) + 9999))) EXCEPT existing)
              SELECT
                  std::min(available)
              ) ELSE .departmentId));
      };
  };
};
