CREATE MIGRATION m1pfp5ma6hc4seedw4jd3vjfryfbe5psrysixt2u4murlxt7hivdua
    ONTO m17u4aufxga7wgmcebhiaapulc7xrqg34hcbmucddbvm4tw5c63kyq
{
  CREATE TYPE Engagement::WorkflowEvent EXTENDING Project::ContextAware {
      CREATE REQUIRED LINK engagement: default::Engagement {
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
      };
      CREATE REQUIRED PROPERTY at: std::datetime {
          SET default := (std::datetime_of_statement());
          SET readonly := true;
      };
      CREATE REQUIRED PROPERTY to: Engagement::Status {
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
  ALTER TYPE default::Engagement {
      CREATE LINK workflowEvents := (.<engagement[IS Engagement::WorkflowEvent]);
      CREATE LINK latestWorkflowEvent := (SELECT
          .workflowEvents ORDER BY
              .at DESC
      LIMIT
          1
      );
      CREATE TRIGGER assertMatchingLatestWorkflowEvent
          AFTER UPDATE, INSERT 
          FOR EACH DO (std::assert(((__new__.latestWorkflowEvent.to ?= __new__.status) OR (NOT (EXISTS (__new__.latestWorkflowEvent)) AND (__new__.status = Engagement::Status.InDevelopment))), message := 'Engagement status must match the latest workflow event'));
  };
  ALTER TYPE Engagement::WorkflowEvent {
      CREATE TRIGGER refreshEngagementStatus
          AFTER DELETE 
          FOR ALL DO (UPDATE
              default::Engagement
          FILTER
              (default::Engagement IN __old__.engagement)
          SET {
              status := (default::Engagement.latestWorkflowEvent.to ?? Engagement::Status.InDevelopment)
          });
      CREATE TRIGGER setEngagementStatus
          AFTER INSERT 
          FOR ALL DO (UPDATE
              default::Engagement
          FILTER
              (default::Engagement IN __new__.engagement)
          SET {
              status := (default::Engagement.latestWorkflowEvent.to ?? Engagement::Status.InDevelopment)
          });
  };
};
