CREATE MIGRATION m1pqxkvfgki4526meuwugacot76zuerjw34bynv25qbjbga3t7ezta
    ONTO m17u4aufxga7wgmcebhiaapulc7xrqg34hcbmucddbvm4tw5c63kyq
{
  CREATE TYPE Engagement::WorkflowEvent EXTENDING Project::ContextAware {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForEngagementWorkflowEvent
          ALLOW DELETE USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE PROPERTY transitionKey: std::uuid {
          SET readonly := true;
      };
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForEngagementWorkflowEvent
          ALLOW INSERT USING (((((default::Role.Administrator IN GLOBAL default::currentRoles) OR ((default::Role.Controller IN GLOBAL default::currentRoles) AND ((.transitionKey IN <std::uuid>{'6eb17e2e-da0a-5277-9db0-e0f12396ff73', '539c7ca2-7c8d-57e1-a262-d385b4d88a6c', '6fa472fc-cf6a-5186-b2f1-46d2ed7fee54', 'd50dc635-50aa-50a6-ae2d-5e32e43a5980', 'f95c8e46-55ae-5e05-bc71-2fce2d940b53', 'e6739a3d-ce68-5a07-8660-1ba46c6bed67'}) ?? false))) OR (EXISTS ((<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)) AND ((.transitionKey IN <std::uuid>{'5dcd3b86-39a5-513a-884b-3126eadb89d3', 'bc699b72-e9bd-5de3-9c1f-e18dd39d2dc3'}) ?? false))) OR (EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND ((.transitionKey IN <std::uuid>{'a535fba1-23c4-5c56-bb82-da6318aeda4d', '80b08b5d-93af-5f1b-b500-817c3624ad5b', 'aed7b16f-5b8b-5b40-9a03-066ad842156e', 'e2f8c0ba-39ed-5d86-8270-d8a7ebce51ff', 'd50dc635-50aa-50a6-ae2d-5e32e43a5980', 'f95c8e46-55ae-5e05-bc71-2fce2d940b53', 'e6739a3d-ce68-5a07-8660-1ba46c6bed67', '30bb2a26-9b91-5fcd-8732-e305325eb1fe', 'd4dbcbb1-704b-5a93-961a-c302bba97866', 'b54cd0d5-942a-5e98-8a71-f5be87bc50b1', 'e14cbcc8-14ad-56a8-9f0d-06d3f670aa7a', 'ff0153a7-70dd-5249-92e4-20e252c3e202', 'a0456858-07ec-59a2-9918-22ee106e2a20', '5dcd3b86-39a5-513a-884b-3126eadb89d3', 'bc699b72-e9bd-5de3-9c1f-e18dd39d2dc3'}) ?? false))));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForEngagementWorkflowEvent
          ALLOW SELECT, UPDATE READ USING (EXISTS ((<default::Role>{'Administrator', 'Controller', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForEngagementWorkflowEvent
          ALLOW UPDATE WRITE ;
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
  ALTER SCALAR TYPE Engagement::Status EXTENDING enum<InDevelopment, DidNotDevelop, Rejected, Active, ActiveChangedPlan, DiscussingTermination, DiscussingReactivation, DiscussingChangeToPlan, DiscussingSuspension, Suspended, FinalizingCompletion, Terminated, Completed, Converted, Unapproved, Transferred, NotRenewed>;
};
