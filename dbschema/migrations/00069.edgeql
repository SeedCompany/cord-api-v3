CREATE MIGRATION m1uqme6noxofu7imqwvszj4ljpybefs7jgamutiv35ttbes5nwd3oq
    ONTO m1dtvcrlfunyjcbw3b7ojqencgpo3cs77jzgkwdjvgkg2gxa7frz4q
{
  ALTER TYPE ProgressReport::ProductProgress::Step {
      CREATE LINK projectContext: Project::Context {
          SET REQUIRED USING (<Project::Context>{});
      };
      EXTENDING Project::ContextAware LAST;
  };
  ALTER TYPE ProgressReport::ProductProgress::Step {
      ALTER LINK projectContext {
          RESET OPTIONALITY;
          DROP OWNED;
          RESET TYPE;
      };
  };
};
