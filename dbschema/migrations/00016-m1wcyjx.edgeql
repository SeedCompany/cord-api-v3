CREATE MIGRATION m1tj2f3et7fsl4f3fainebzekv3tawlwplulftdv35tfzymidhi6ga
    ONTO m1izndhxu7mkhaey6hvgllg24v4u5et3kpkbuouot3kig4q7cfwwha
{
  ALTER TYPE Project::WorkflowEvent {
      ALTER ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProjectWorkflowEvent USING ((((((((((((default::Role.Administrator IN GLOBAL default::currentRoles) OR ((default::Role.ConsultantManager IN GLOBAL default::currentRoles) AND ((.transitionKey IN <std::uuid>{'1397f444-2dad-5467-aa96-107eae27d807', '7f23ab0e-fe6c-58a5-aaa1-7dd209e3e79a'}) ?? false))) OR ((EXISTS ((<default::Role>{'Consultant', 'ConsultantManager'} INTERSECT GLOBAL default::currentRoles)) AND .isMember) AND ((.transitionKey IN <std::uuid>{'1397f444-2dad-5467-aa96-107eae27d807', '7f23ab0e-fe6c-58a5-aaa1-7dd209e3e79a'}) ?? false))) OR ((default::Role.Controller IN GLOBAL default::currentRoles) AND ((.transitionKey IN <std::uuid>{'3c9662f5-db67-5403-b416-7aeeef0fb350', 'a050d4e1-b446-52ab-b6c9-1ab045aa91f5', 'ffff1e49-94ca-5601-ada5-6cc52c93d517', '78af1187-552f-5f7a-b6ec-c737d300aaa9', 'b65b9db4-d5b3-5557-9c1e-a25fc9edc538', '0d9f9039-7099-5faf-9b08-099d47a5cc42', 'a1088f2c-478c-5512-8a60-e4feff5538cc', 'c4663d2d-8b6d-5f45-8fb3-cb71e34555a0', 'ce663888-ca28-55cd-9e9b-1ea5b75e76b2'}) ?? false))) OR ((default::Role.FieldOperationsDirector IN GLOBAL default::currentRoles) AND ((.transitionKey IN <std::uuid>{'a03d96d7-bc75-51d4-b793-88aa02e26cfc', '2f012ffe-893f-52ea-b9f0-39f313b0dd1f', 'aa718b6c-8f16-589c-a0d4-50d5555534d1'}) ?? false))) OR (EXISTS ((<default::Role>{'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)) AND ((.transitionKey IN <std::uuid>{'f48d59a0-67e7-57e2-9f7c-8f9cd8c3c01c', '857c7594-8af8-524e-a61f-15b6ac2bac7d', 'f4726d2a-f92d-58e5-a360-a22560f65971', '9cac7636-b5af-57c7-977d-ddaa2cd837aa'}) ?? false))) OR ((EXISTS ((<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)) AND .isMember) AND ((.transitionKey IN <std::uuid>{'f48d59a0-67e7-57e2-9f7c-8f9cd8c3c01c', '857c7594-8af8-524e-a61f-15b6ac2bac7d', 'f4726d2a-f92d-58e5-a360-a22560f65971', '9cac7636-b5af-57c7-977d-ddaa2cd837aa'}) ?? false))) OR (((default::Role.MultiplicationFinanceApprover IN GLOBAL default::currentRoles) AND (<std::str>.project.type = 'MultiplicationTranslation')) AND ((.transitionKey = <std::uuid>'3c9662f5-db67-5403-b416-7aeeef0fb350') ?? false))) OR (EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND ((((<std::str>.project.type = 'MomentumTranslation') AND .isMember) AND ((.transitionKey IN <std::uuid>{'1397f444-2dad-5467-aa96-107eae27d807', '7f23ab0e-fe6c-58a5-aaa1-7dd209e3e79a'}) ?? false)) OR (.isMember AND ((.transitionKey IN <std::uuid>{'6ce4c5d0-5034-55c1-bf80-bf5992fe38bf', '37e42c6d-260b-51c7-98c3-d918ba057480', '4edf8b35-b462-590d-bc2c-fd0d20b46a6d', '06c4afc9-2349-50ae-ae4b-a506f5b80dee', '9d2c13e3-d73f-58bc-b68d-c447f0caa91d', 'afe0b316-57ef-5640-a098-4fa1cf0a81b9', '356c7be5-08f5-5f36-a8ad-dfc5509a872e', '3c5607fb-1bba-5c02-a7de-24e4bcf2f27b', 'aa17add1-15eb-5054-80be-809480f8b0eb', '4d495617-2fa4-5dc3-a5ec-63ae21731f1c', '3e687176-4f02-5f2e-ad5a-374f39504034', '2dc45f2c-c7c8-5f60-9f8c-b9994fcd6b82', '45100e48-16f0-5ac4-a0cb-7e8214414bf8', '04556e06-0efe-5bad-b7a7-9b2524e9c9cf', 'c85a70bb-ff30-5540-8c75-f0c543609418', '04fa7ef6-4a45-55d9-93a3-99a8fe84d399', '479ce997-0cb6-5c38-af9b-a36d3ea24e82', '792e3e28-8237-53a3-893b-e6d4e5476265', '77ba67dd-b2c3-5e7b-9f33-f55c09279f3e', '0c610243-ba8f-565c-ab17-1b62e1fa6d06', '2537d694-d712-5d3f-8c8a-b07002265e39', '2267fe55-7a97-5aa1-bbc1-403e59f71f9d', 'fe0ec249-f6d6-5ce7-97c4-c19720a057cd', '758a333a-7484-5fb4-aa4c-9c620f542551', '2063137a-7901-5185-b1f8-fe76c56f5c67', 'f4726d2a-f92d-58e5-a360-a22560f65971', '9cac7636-b5af-57c7-977d-ddaa2cd837aa'}) ?? false))))) OR (((default::Role.ProjectManager IN GLOBAL default::currentRoles) AND .isMember) AND ((.transitionKey = <std::uuid>'e03186b4-40e6-53c4-ac64-8fe62f7952e3') ?? false))) OR (EXISTS ((<default::Role>{'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND ((.transitionKey IN <std::uuid>{'60e21d6d-d4e0-5103-8eee-4f4ff80404b1', '2126603a-13bc-5356-a062-d11647c0f5f6', 'd22e15d9-c4cb-564d-b429-8cef0d482e14', 'b412a3de-d8b9-5068-9e90-e6ead0b4407c', '61b12ecf-6024-54eb-9f49-83b1dc6769f1', '9c8e953f-eecd-5a42-a806-e0e3187dda66', '99dcddcb-4351-5643-a196-9fd93fe68760', 'd5ead4fc-5d99-5a82-8c32-8640ffe26162', 'aa4a45d0-d611-56f2-bd90-d47fc4626d60', '60483d90-c54f-5dd4-b233-b53287ba4324', '7f9b7302-3ea4-5b77-b9ac-7191d11adb94', '006aebaa-83df-5225-add8-062c498191fe', 'd9aaa5d1-da74-5042-915f-e7726367ea4e', 'bcfc9f9b-c6d6-59c3-8449-42620f806211', 'f1694429-c062-5895-bff1-12e73cf8eea5', '90fb9642-7b38-510c-bc45-84e722c145b6', 'dae01c7f-13d4-5246-a3f6-2fa3e067b505', 'f7511418-bce7-5901-b141-06a470955a86', '3e19a59f-a414-5c58-a1ff-7bfc6cff7eef', '6b08ebc1-5279-58fc-b2c5-26147b278426', '05d1a69d-e717-5ca9-b011-688cf58a924f', '6ce4c5d0-5034-55c1-bf80-bf5992fe38bf', '37e42c6d-260b-51c7-98c3-d918ba057480', '4edf8b35-b462-590d-bc2c-fd0d20b46a6d', '06c4afc9-2349-50ae-ae4b-a506f5b80dee', '9d2c13e3-d73f-58bc-b68d-c447f0caa91d', 'afe0b316-57ef-5640-a098-4fa1cf0a81b9', '356c7be5-08f5-5f36-a8ad-dfc5509a872e', '3c5607fb-1bba-5c02-a7de-24e4bcf2f27b', 'aa17add1-15eb-5054-80be-809480f8b0eb', '4d495617-2fa4-5dc3-a5ec-63ae21731f1c', '3e687176-4f02-5f2e-ad5a-374f39504034', '2dc45f2c-c7c8-5f60-9f8c-b9994fcd6b82', '45100e48-16f0-5ac4-a0cb-7e8214414bf8', '04556e06-0efe-5bad-b7a7-9b2524e9c9cf', 'c85a70bb-ff30-5540-8c75-f0c543609418', '04fa7ef6-4a45-55d9-93a3-99a8fe84d399', '479ce997-0cb6-5c38-af9b-a36d3ea24e82', '792e3e28-8237-53a3-893b-e6d4e5476265', '77ba67dd-b2c3-5e7b-9f33-f55c09279f3e', '0c610243-ba8f-565c-ab17-1b62e1fa6d06', '2537d694-d712-5d3f-8c8a-b07002265e39', '2267fe55-7a97-5aa1-bbc1-403e59f71f9d', 'fe0ec249-f6d6-5ce7-97c4-c19720a057cd', '758a333a-7484-5fb4-aa4c-9c620f542551', '2063137a-7901-5185-b1f8-fe76c56f5c67', 'f4726d2a-f92d-58e5-a360-a22560f65971', '9cac7636-b5af-57c7-977d-ddaa2cd837aa', '1397f444-2dad-5467-aa96-107eae27d807', '7f23ab0e-fe6c-58a5-aaa1-7dd209e3e79a'}) ?? false))));
  };
};
