CREATE MIGRATION m1nrdwc3vdx7w2iui6bxlxxe3urjirypmaw5ft33yehtq33dgeyovq
    ONTO m1jtglkzb7fc5jezkxnximpq4uqqykdyevfvsnkzf26fv4ouxv274a
{
  ALTER TYPE default::Project {
      ALTER PROPERTY departmentId {
          DROP REWRITE
              INSERT ;
          };
      };
  ALTER TYPE default::Project {
      ALTER PROPERTY departmentId {
          CREATE REWRITE
              INSERT 
              USING ((IF ((NOT (EXISTS (.departmentId)) AND (.status <= Project::Status.Active)) AND (.step >= Project::Step.PendingFinanceConfirmation)) THEN (WITH
                  info := 
                      (IF (__subject__ IS default::MultiplicationTranslationProject) THEN (
                          prefix := 8,
                          startingOffset := 201
                      ) ELSE (
                          prefix := (std::assert_exists(__subject__.primaryLocation.fundingAccount, message := 'Project must have a primary location')).accountNumber,
                          startingOffset := 11
                      ))
              SELECT
                  std::min((<std::str>std::range_unpack(std::range(((info.prefix * 10000) + info.startingOffset), ((info.prefix * 10000) + 9999))) EXCEPT (DETACHED default::Project).departmentId))
              ) ELSE .departmentId));
      };
  };
  ALTER TYPE default::Project {
      ALTER PROPERTY departmentId {
          DROP REWRITE
              UPDATE ;
          };
      };
  ALTER TYPE default::Project {
      ALTER PROPERTY departmentId {
          CREATE REWRITE
              UPDATE 
              USING ((IF ((NOT (EXISTS (.departmentId)) AND (.status <= Project::Status.Active)) AND (.step >= Project::Step.PendingFinanceConfirmation)) THEN (WITH
                  info := 
                      (IF (__subject__ IS default::MultiplicationTranslationProject) THEN (
                          prefix := 8,
                          startingOffset := 201
                      ) ELSE (
                          prefix := (std::assert_exists(__subject__.primaryLocation.fundingAccount, message := 'Project must have a primary location')).accountNumber,
                          startingOffset := 11
                      ))
              SELECT
                  std::min((<std::str>std::range_unpack(std::range(((info.prefix * 10000) + info.startingOffset), ((info.prefix * 10000) + 9999))) EXCEPT (DETACHED default::Project).departmentId))
              ) ELSE .departmentId));
      };
  };
};
