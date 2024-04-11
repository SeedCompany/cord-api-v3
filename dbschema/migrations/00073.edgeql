CREATE MIGRATION m15sissgmcapfcx2mkqx3plubij4nmkn7r4hk73blnususy6il3hpq
    ONTO m1pj5borebvxev6umfekcrl6cxhphhacperp3ekduggieospl3xlqq
{
  ALTER TYPE default::Project {
      CREATE PROPERTY departmentId: std::str {
          CREATE CONSTRAINT std::exclusive;
          CREATE CONSTRAINT std::expression ON (((<std::int32>__subject__ > 0) AND (std::len(__subject__) = 5)));
          CREATE REWRITE
              INSERT 
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
                      (<std::str>std::range_unpack(std::range(((fa.accountNumber * 10000) + 11), ((fa.accountNumber * 10000) + 9999))) EXCEPT existing)
              SELECT
                  std::min(available)
              ) ELSE .departmentId));
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
                      (<std::str>std::range_unpack(std::range(((fa.accountNumber * 10000) + 11), ((fa.accountNumber * 10000) + 9999))) EXCEPT existing)
              SELECT
                  std::min(available)
              ) ELSE .departmentId));
      };
  };
};
