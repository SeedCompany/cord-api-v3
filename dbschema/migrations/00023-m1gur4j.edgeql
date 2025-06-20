CREATE MIGRATION m1rgcov4cvwz6cct475bg4236373bwpc4piydlw5ytakm5fyn7g2eq
    ONTO m1xp5mbrgbcsdkvhimirvlj2hueu7m7aeyowjcp3wl4itrzityln4q
{
  ALTER TYPE default::Project {
    CREATE LINK primaryPartnership := (
      select Partnership
      filter Partnership.primary and Partnership.project = __source__
      limit 1
    );
    ALTER PROPERTY departmentId {
      DROP REWRITE INSERT, UPDATE;
      CREATE REWRITE INSERT, UPDATE USING ((
        IF (
          (NOT (EXISTS (.departmentId))
          AND (.status <= Project::Status.Active))
          AND (.step >= Project::Step.PendingFinanceConfirmation)
        ) THEN (
          WITH block := (
            IF (__subject__ IS default::MultiplicationTranslationProject)
            THEN (
              WITH primaryPartnership := std::assert_exists(__subject__.primaryPartnership, message := 'Project must have a primary partnership'),
              SELECT std::assert_exists(primaryPartnership.partner.departmentIdBlock, message := 'Available Department IDs have not been declared')
            )
            ELSE (std::assert_exists((std::assert_exists(__subject__.primaryLocation, message := 'Project must have a primary location')).fundingAccount, message := "Project's primary location must have a funding account")).departmentIdBlock)
          SELECT std::assert_exists(block.nextAvailable, message := 'No department ID is available')
        ) ELSE .departmentId
      ));
    };
  };
};
