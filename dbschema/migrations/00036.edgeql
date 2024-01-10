CREATE MIGRATION m1ydhle3dwjru34saeiidf5dyepbesugdwttrvnsyxhezpme5bfqga
    ONTO m13bndkbclxwviy3uj4eskx56bd2chw2xbvfn5pae557oslmbz2ssa
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
