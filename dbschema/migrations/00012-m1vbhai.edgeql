CREATE MIGRATION m1vbhain4p2tmhlgcbbsj2bq7p4dcif4vpgrhef6afjryylrofzqma
    ONTO m17u4aufxga7wgmcebhiaapulc7xrqg34hcbmucddbvm4tw5c63kyq
{
  CREATE TYPE Engagement::WorkflowEvent EXTENDING Project::ContextAware {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForEngagementWorkflowEvent
          ALLOW DELETE USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE PROPERTY transitionKey: std::uuid {
          SET readonly := true;
      };
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForEngagementWorkflowEvent
          ALLOW INSERT USING (((((((default::Role.Administrator IN GLOBAL default::currentRoles) OR ((default::Role.Controller IN GLOBAL default::currentRoles) AND ((.transitionKey IN <std::uuid>{'bb30763a-b0fe-53f0-91fa-938357dafd23', '691d9824-78d2-59cf-9936-901ad4ef99b2', '4e1f2ab6-9be4-52a2-a68a-a3e3210bda55', '8c6f8a48-f5f5-5a15-80ac-d8521e972ecb', '4a4a07a3-d6fc-5466-aebf-b08e4034800a', '380b11ac-e303-5a7d-948a-acf6c66ce25e'}) ?? false))) OR (EXISTS ((<default::Role>{'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)) AND ((.transitionKey IN <std::uuid>{'5dcd3b86-39a5-513a-884b-3126eadb89d3', 'bc699b72-e9bd-5de3-9c1f-e18dd39d2dc3'}) ?? false))) OR ((EXISTS ((<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)) AND .isMember) AND ((.transitionKey IN <std::uuid>{'5dcd3b86-39a5-513a-884b-3126eadb89d3', 'bc699b72-e9bd-5de3-9c1f-e18dd39d2dc3'}) ?? false))) OR ((EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND .isMember) AND ((.transitionKey IN <std::uuid>{'691d9824-78d2-59cf-9936-901ad4ef99b2', 'a535fba1-23c4-5c56-bb82-da6318aeda4d', '380b11ac-e303-5a7d-948a-acf6c66ce25e', '4a4a07a3-d6fc-5466-aebf-b08e4034800a', '80b08b5d-93af-5f1b-b500-817c3624ad5b', '735a1b6a-8811-5b65-beee-cbe6f67f431d', 'e14cbcc8-14ad-56a8-9f0d-06d3f670aa7a', 'aed7b16f-5b8b-5b40-9a03-066ad842156e', 'ff0153a7-70dd-5249-92e4-20e252c3e202', 'e2f8c0ba-39ed-5d86-8270-d8a7ebce51ff', '5dcd3b86-39a5-513a-884b-3126eadb89d3', 'bc699b72-e9bd-5de3-9c1f-e18dd39d2dc3'}) ?? false))) OR (EXISTS ((<default::Role>{'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND ((.transitionKey IN <std::uuid>{'691d9824-78d2-59cf-9936-901ad4ef99b2', 'a535fba1-23c4-5c56-bb82-da6318aeda4d', '380b11ac-e303-5a7d-948a-acf6c66ce25e', '4a4a07a3-d6fc-5466-aebf-b08e4034800a', '80b08b5d-93af-5f1b-b500-817c3624ad5b', '735a1b6a-8811-5b65-beee-cbe6f67f431d', 'e14cbcc8-14ad-56a8-9f0d-06d3f670aa7a', 'aed7b16f-5b8b-5b40-9a03-066ad842156e', 'ff0153a7-70dd-5249-92e4-20e252c3e202', 'e2f8c0ba-39ed-5d86-8270-d8a7ebce51ff', '5dcd3b86-39a5-513a-884b-3126eadb89d3', 'bc699b72-e9bd-5de3-9c1f-e18dd39d2dc3', 'bb30763a-b0fe-53f0-91fa-938357dafd23', 'd4dbcbb1-704b-5a93-961a-c302bba97866', 'b54cd0d5-942a-5e98-8a71-f5be87bc50b1', 'a0456858-07ec-59a2-9918-22ee106e2a20'}) ?? false))));
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
