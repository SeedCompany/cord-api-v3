CREATE MIGRATION m1ipyz27ib3tsxltvx3w2fjojxiw75drzuz4j2edtoctf4zzmwke6a
    ONTO m1gq2hsptfudyqzcqhaz3o5ikdckynzcdegdixqtrdtnisldpyqv6a
{
  CREATE TYPE Project::WorkflowEvent {
    CREATE REQUIRED LINK project: default::Project {
      SET readonly := true;
    };
    CREATE REQUIRED PROPERTY at: std::datetime {
      SET default := (std::datetime_of_statement());
      SET readonly := true;
    };
    CREATE REQUIRED PROPERTY step: Project::Step {
      SET readonly := true;
    };
    CREATE REQUIRED LINK who: default::Actor {
      SET default := (GLOBAL default::currentActor);
      SET readonly := true;
    };
    CREATE PROPERTY notes: default::RichText {
      SET readonly := true;
    };
    CREATE PROPERTY transitionKey: std::uuid {
      SET readonly := true;
    };
  };
  ALTER TYPE default::Project {
    CREATE LINK workflowEvents := (.<project[IS Project::WorkflowEvent]);
  };
  ALTER TYPE default::Project {
    CREATE LINK latestWorkflowEvent := (
      SELECT .workflowEvents
      ORDER BY .at DESC
      LIMIT 1
    );
  };

  for project in (select Project filter .step != Project::Step.EarlyConversations)
  insert Project::WorkflowEvent {
    project := project,
    who := (select SystemAgent filter .name = "Ghost"),
    at := project.stepChangedAt,
    step := project.step
  };

  ALTER TYPE default::Project {
    ALTER PROPERTY step {
      RESET default;
      USING ((.latestWorkflowEvent.step ?? Project::Step.EarlyConversations));
      RESET OPTIONALITY;
    };
    DROP PROPERTY stepChangedAt;
  };
  ALTER TYPE default::InternshipProject {
    ALTER PROPERTY step {
      RESET default;
    };
  };
  ALTER TYPE default::TranslationProject {
    ALTER PROPERTY step {
      RESET default;
    };
  };
  ALTER TYPE default::MomentumTranslationProject {
    ALTER PROPERTY step {
      RESET default;
    };
  };
  ALTER TYPE default::MultiplicationTranslationProject {
    ALTER PROPERTY step {
      RESET default;
    };
  };
};
