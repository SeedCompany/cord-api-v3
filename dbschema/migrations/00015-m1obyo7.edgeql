CREATE MIGRATION m1iqvzyj6bl4erz45wwl75h7oejlovkdqwcjsbryrjk3akrtozgibq
    ONTO m1l7uuqm3my5klng3a2m6wqoswaq63h6jb63gvioafpj2t5yffxduq
{
  CREATE MODULE Finance IF NOT EXISTS;
  CREATE MODULE Finance::Department IF NOT EXISTS;
  CREATE FUNCTION Finance::Department::enumerateIds(block: multirange<std::int64>) -> SET OF std::str USING (
    WITH ids := std::range_unpack(std::multirange_unpack(block))
    SELECT (IF (ids < 10000) THEN std::str_pad_start(<std::str>ids, 5, '0') ELSE <std::str>ids)
  );
  CREATE TYPE Finance::Department::IdBlock {
    CREATE REQUIRED PROPERTY blocks: multirange<std::int64>;
    CREATE MULTI PROPERTY programs: Project::Type {
      CREATE ANNOTATION std::description := 'Effectively static, but here to to facilitate metrics.';
    };
    CREATE TRIGGER assertValidBlocks
      AFTER UPDATE, INSERT
      FOR EACH DO (FOR block IN std::assert_exists(std::multirange_unpack(__new__.blocks))
      UNION std::assert(((std::assert_exists(std::range_get_lower(block)) UNION std::assert_exists(std::range_get_upper(block))) > 0)));
  };
  CREATE FUNCTION Finance::Department::remainingIds(blocks: array<Finance::Department::IdBlock>) -> std::int64 USING (
    std::count((
      SELECT (Finance::Department::enumerateIds(std::array_unpack(blocks).blocks)
      EXCEPT default::Project.departmentId)
    ))
  );
  CREATE FUNCTION Finance::Department::totalIds(blocks: array<Finance::Department::IdBlock>) ->
    std::int64 USING (std::count(Finance::Department::enumerateIds(std::array_unpack(blocks).blocks)));
  ALTER TYPE Finance::Department::IdBlock {
    CREATE PROPERTY nextAvailable := (
      std::min((
        SELECT (Finance::Department::enumerateIds(.blocks) EXCEPT default::Project.departmentId)
      ))
    );
    CREATE PROPERTY remaining := (Finance::Department::remainingIds([__source__]));
    CREATE PROPERTY total := (Finance::Department::totalIds([__source__]));
  };
  ALTER TYPE default::FundingAccount {
    CREATE REQUIRED LINK departmentIdBlock: Finance::Department::IdBlock {
      SET default := (
        INSERT Finance::Department::IdBlock {
          blocks := std::multirange([std::range(((.accountNumber * 10000) + 11), ((.accountNumber + 1) * 10000))]),
          programs := {Project::Type.MomentumTranslation, Project::Type.Internship}
        }
      );
      ON SOURCE DELETE DELETE TARGET;
    };
  };
  ALTER TYPE default::Partner {
    CREATE LINK departmentIdBlock: Finance::Department::IdBlock {
      ON SOURCE DELETE DELETE TARGET;
    };
  };
  ALTER TYPE default::Project {
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
            THEN std::assert_exists((std::assert_exists(((SELECT __subject__.partnerships FILTER .primary)).partner, message := 'Project must have a primary partnership')).departmentIdBlock, message := 'Available Department IDs have not been declared')
            ELSE std::assert_exists(__subject__.primaryLocation.fundingAccount.departmentIdBlock, message := 'Project must have a primary location'))
          SELECT std::assert_exists(block.nextAvailable, message := 'No department ID is available')
        ) ELSE .departmentId
      ));
    };
  };
};
