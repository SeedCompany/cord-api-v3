CREATE MIGRATION m1sznh4tznllmlcsn2n3wxrwih5syqmxdc3fjtovmy4grty2qhczka
    ONTO m1bzq66kx6aa3adornnuhmqpmmqmj6z6i2qt6higxnkz7kw3fspcbq
{
  CREATE TYPE Project::WorkflowEvent {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProjectWorkflowEvent
          ALLOW DELETE USING ((default::Role.Administrator IN GLOBAL default::currentRoles));
      CREATE PROPERTY transitionKey: std::uuid {
          SET readonly := true;
      };
      CREATE ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProjectWorkflowEvent
          ALLOW INSERT USING ((((((((default::Role.Administrator IN GLOBAL default::currentRoles) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager'} INTERSECT GLOBAL default::currentRoles)) AND ((.transitionKey IN <std::uuid>{'b4feb4f5-1687-5012-9111-ec4c4c950eff', 'ac603cdb-e6a8-51de-b29f-866f4cd8df6e'}) ?? false))) OR ((default::Role.Controller IN GLOBAL default::currentRoles) AND ((.transitionKey IN <std::uuid>{'a2a8faef-daea-5221-9c8e-a9b4d3447958', '9499026e-9ed0-5e56-a8fd-9f976b6253a2', 'd114e21f-f697-5eed-bbce-f6b3466e5314', 'dadc642c-4013-522a-b341-1cf7db1a589f', '301de915-b934-5b5f-a4cb-889fff26fe22', '0429940c-e1e0-51e5-8cdc-a17ad2488ce4', 'c7cc144b-2625-5ad8-bca9-a95729c807b9', '5b725348-1283-5025-8146-0ed53b3efeae', 'ab056cf0-05af-57ca-8510-b0e1dfc38726'}) ?? false))) OR ((default::Role.FieldOperationsDirector IN GLOBAL default::currentRoles) AND ((.transitionKey IN <std::uuid>{'f3e4492c-1e9e-5d49-960b-f6aa21ba3062', '47ed9fbc-7c6d-50df-a731-e41f8a925c6c', 'e5774cd9-ddba-57d0-9766-c9599b7c360b'}) ?? false))) OR (EXISTS ((<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)) AND ((.transitionKey IN <std::uuid>{'f506e3e8-f4af-5348-9c6c-08e79f8d54fa', '094176ef-407c-5599-aa04-d4181b6a175b', '963270ba-4fb7-5fcc-986b-9c169aaa09fc', 'ac2918a6-63d4-5c65-99ab-1609349cef54'}) ?? false))) OR (EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND ((.transitionKey IN <std::uuid>{'978c2e89-90de-5151-ab04-96e02bd6cb86', 'ba838c42-a3ec-523c-9579-253d7c40c8d5', '31c540f2-81af-54fc-bdd1-72863a244b87', '67250264-3cd6-5eb3-ade0-ce35d1535bf0', '92351eeb-3045-5790-80eb-cc60f1832224', 'f1ec20d9-607a-5f72-a0b0-265ef2ca38f0', 'b4feb4f5-1687-5012-9111-ec4c4c950eff', 'ac603cdb-e6a8-51de-b29f-866f4cd8df6e', '1e804776-a92b-5d9c-96b5-80494546547c', '7b53971b-eab7-5f77-a483-a1970161594c', '5ee57376-eb07-547e-97a3-d5e8d3d5e336', 'cf56600f-e5f7-5c97-8b35-ed69c7c2685c', '772129cf-960e-58e9-a37a-6d215b16b91d', '8f24f37c-2fa9-5eac-b275-e5e6048eaf3c', 'd44dab7e-0634-5c3b-96a6-0428e723977c', 'e24cd4d8-bb8b-5373-a872-36b2122b2ec3', '59d412d0-1c44-598d-8387-d02e7e82e816', '0a910217-643a-5d2a-a1c0-1e391fbf7bfd', '4e06fe25-d6f7-5d35-8e5e-e4f0f4fe56d8', 'fed769bf-1124-5798-9274-19214a08c1b9', '0e5cc01e-977c-516b-9116-a3705e4aff29', 'ee88de05-88cb-5db2-94d2-c81f736419c6', '00588873-c813-56a7-b44d-524f0fa4ee9c', '05bd4f8d-e763-508a-b44e-aec4ea6ada53', '96b07f99-121d-5b9b-a5ae-abc897c4c8dd', 'dee9f990-4b17-53f8-abcb-61cab8033895', '808fc73d-a8b9-5374-9087-7dacf20ea66e', '783440f6-0836-54ec-aacd-4082d8ac3a1b', '963270ba-4fb7-5fcc-986b-9c169aaa09fc', 'ac2918a6-63d4-5c65-99ab-1609349cef54'}) ?? false))) OR (EXISTS ((<default::Role>{'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND ((.transitionKey IN <std::uuid>{'03577b19-d799-5029-af29-d02c3f8926a0', '9ea3a784-7d79-57e3-9d6b-b84e45283631', '12af5736-92bb-5097-868d-8a4fe3691a47', '7a0cbaf1-7113-523f-8339-15781b9435a5', '702b47e7-ad81-5843-8e33-3a6d24d9413f', 'd59f946b-d7b4-5e09-90ac-9b3adff7a15c', 'cf79e84e-1485-533a-9eca-48d1dd89f6ae', '0d4433e8-4fb3-5119-a023-f248b0428220', '21231706-d17f-5273-961a-bd90db115f6d', '2c3a86f7-bf90-5ca2-a022-d9382161601f', 'd149f82b-b2fe-5f4b-8f5d-9f24f48a7006', '7a980e5d-58fe-5f0f-aca5-d8dad2483f02', '38a941c4-1c50-504f-a98e-e3a6edcc5459', '934c2439-98b2-568e-b943-4181c4e94b7c', '732b175a-f41d-59a3-a4ef-9f47a72355a0', '591ec845-e612-5e82-9061-5176d24e3ab1', '28da9161-dbf2-5ada-8b92-42a230fe35c8', '17214902-01da-5b7f-8575-252ce3f9fdd7', 'd01a7fa7-c7bf-5e08-a610-3797febe9f97'}) ?? false))));
      CREATE ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProjectWorkflowEvent
          ALLOW SELECT, UPDATE READ USING (EXISTS ((<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'Controller', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Leadership', 'ProjectManager', 'RegionalDirector'} INTERSECT GLOBAL default::currentRoles)));
      CREATE ACCESS POLICY CanUpdateWriteGeneratedFromAppPoliciesForProjectWorkflowEvent
          ALLOW UPDATE WRITE ;
      CREATE REQUIRED LINK project: default::Project {
          ON TARGET DELETE DELETE SOURCE;
          SET readonly := true;
      };
      CREATE REQUIRED PROPERTY at: std::datetime {
          SET default := (std::datetime_of_statement());
          SET readonly := true;
      };
      CREATE REQUIRED PROPERTY to: Project::Step {
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
  ALTER TYPE default::Project {
      CREATE LINK workflowEvents := (.<project[IS Project::WorkflowEvent]);
  };
  ALTER TYPE default::Project {
      CREATE LINK latestWorkflowEvent := (SELECT
          .workflowEvents ORDER BY
              .at DESC
      LIMIT
          1
      );
      CREATE TRIGGER assertMatchingLatestWorkflowEvent
          AFTER UPDATE, INSERT 
          FOR EACH DO (std::assert(((__new__.latestWorkflowEvent.to ?= __new__.step) OR (NOT (EXISTS (__new__.latestWorkflowEvent)) AND (__new__.step = Project::Step.EarlyConversations))), message := 'Project step must match the latest workflow event'));
      DROP PROPERTY stepChangedAt;
  };
  ALTER TYPE Project::WorkflowEvent {
      CREATE TRIGGER refreshProjectStep
          AFTER DELETE 
          FOR ALL DO (UPDATE
              default::Project
          FILTER
              (default::Project IN __old__.project)
          SET {
              step := (default::Project.latestWorkflowEvent.to ?? Project::Step.EarlyConversations)
          });
      CREATE TRIGGER setProjectStep
          AFTER INSERT 
          FOR ALL DO (UPDATE
              default::Project
          FILTER
              (default::Project IN __new__.project)
          SET {
              step := (default::Project.latestWorkflowEvent.to ?? Project::Step.EarlyConversations)
          });
  };
};
