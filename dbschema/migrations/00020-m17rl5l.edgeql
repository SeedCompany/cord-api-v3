CREATE MIGRATION m17rl5lo5wwq63duwmpqjtdqfuhq3luocyigofuobamdcu6l4dlepq
    ONTO m132fzeektqf342ie6nwpmz4blp3ewrncp72ysjtngs32wybs3rkza
{
  ALTER TYPE default::Language {
    ALTER LINK projects {
      USING (SELECT default::TranslationProject FILTER (__source__ IN .languages));
    };
  };
  ALTER TYPE default::LanguageEngagement {
    ALTER TRIGGER denyDuplicateFirstScriptureBasedOnOtherEngagement USING (
      std::assert(
        NOT (EXISTS ((SELECT __new__.language.engagements FILTER std::assert_single(.firstScripture)))),
        message := 'Another engagement has already been marked as having done the first scripture'
      )
    );
  };
};
