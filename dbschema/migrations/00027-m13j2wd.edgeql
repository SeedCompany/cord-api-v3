CREATE MIGRATION m13j2wdmzu2ee56a7cpvryzfqdoexqgfx2pbhqrdnrh5cjtkgybwhq
    ONTO m1jijhhv6wfb5l6pxb65ubr2y4on3mxkdrhufizmpmirid4hadso3a
{
  ALTER TYPE Budget::Record {
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForBudgetRecord USING ((((default::Role.ConsultantManager IN GLOBAL default::currentRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium))) OR EXISTS ((<default::Role>{'FieldOperationsDirector', 'FieldServices', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'ExperienceOperations', 'ProjectManager', 'RegionalDirector'} INTERSECT GLOBAL default::currentRoles))));
  };
  ALTER TYPE Engagement::Ceremony {
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForCeremony USING ((EXISTS ((<default::Role>{'FieldOperationsDirector', 'FieldPartner', 'FieldServices', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'ProjectManager', 'RegionalDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'Intern', 'Mentor', 'Translator'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
  };
  ALTER TYPE ProgressReport::ProductProgress::Step {
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForStepProgress USING (((((EXISTS ((<default::Role>{'Administrator', 'FieldOperationsDirector', 'FieldServices', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)) OR (((default::Role.FieldPartner IN GLOBAL default::currentRoles) AND .isMember) AND (<std::str>.variant = 'partner'))) OR ((EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND .isMember) AND (<std::str>.variant IN {'official', 'partner'}))) OR ((default::Role.ConsultantManager IN GLOBAL default::currentRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'Intern', 'Mentor'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
  };
  ALTER TYPE Project::Member {
      ALTER ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForProjectMember USING ((EXISTS ((<default::Role>{'ConsultantManager', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldServices', 'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProjectMember USING ((EXISTS ((<default::Role>{'ConsultantManager', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldServices', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'ProjectManager', 'RegionalDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Intern', 'Mentor', 'Translator'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
  };
  ALTER TYPE Tool::Usage {
      ALTER ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForToolUsage USING (WITH
          isMember := 
              (.container[IS Project::ContextAware].isMember ?? false)
      SELECT
          (EXISTS ((<default::Role>{'FieldOperationsDirector', 'FieldServices'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND isMember))
      );
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForToolUsage USING (WITH
          isMember := 
              (.container[IS Project::ContextAware].isMember ?? false)
      SELECT
          ((EXISTS ((<default::Role>{'Consultant', 'ConsultantManager'} INTERSECT GLOBAL default::currentRoles)) AND isMember) OR EXISTS ((<default::Role>{'FieldOperationsDirector', 'FieldServices', 'ProjectManager', 'RegionalDirector'} INTERSECT GLOBAL default::currentRoles)))
      );
  };
  ALTER TYPE User::Education {
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForEducation USING (EXISTS ((<default::Role>{'ConsultantManager', 'FieldOperationsDirector', 'FieldServices', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'ProjectManager', 'RegionalDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)));
  };
  ALTER TYPE default::Budget {
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForBudget USING ((((default::Role.ConsultantManager IN GLOBAL default::currentRoles) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium))) OR EXISTS ((<default::Role>{'FieldOperationsDirector', 'FieldServices', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Marketing', 'Fundraising', 'ExperienceOperations', 'ProjectManager', 'RegionalDirector'} INTERSECT GLOBAL default::currentRoles))));
  };
  ALTER TYPE default::Engagement {
      ALTER ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForEngagement USING ((((EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)) AND .isMember) AND (<std::str>.status = 'InDevelopment')) OR (default::Role.FieldServices IN GLOBAL default::currentRoles)));
      ALTER ACCESS POLICY CanInsertGeneratedFromAppPoliciesForEngagement USING ((((EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)) AND .isMember) AND ((<std::str>.project.status = 'InDevelopment') OR (<std::str>.project.step = 'DiscussingChangeToPlan'))) OR (default::Role.FieldServices IN GLOBAL default::currentRoles)));
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForEngagement USING ((EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'FieldServices', 'Marketing', 'Fundraising', 'ExperienceOperations', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Intern', 'Mentor', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'Translator'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
  };
  ALTER TYPE default::Producible {
      ALTER ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProducible USING (EXISTS ((<default::Role>{'FieldOperationsDirector', 'FieldServices', 'ProjectManager', 'RegionalDirector'} INTERSECT GLOBAL default::currentRoles)));
  };
  ALTER TYPE default::PeriodicReport {
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForPeriodicReport USING (WITH
          isMember := 
              (.container[IS Project::ContextAware].isMember ?? false)
          ,
          sensitivity := 
              (.container[IS Project::ContextAware].sensitivity ?? default::Sensitivity.High)
      SELECT
          ((EXISTS ((<default::Role>{'ExperienceOperations', 'FieldOperationsDirector', 'FieldPartner', 'FieldServices', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'ProjectManager', 'RegionalDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'ConsultantManager', 'Marketing', 'Fundraising', 'ExperienceOperations'} INTERSECT GLOBAL default::currentRoles)) AND (isMember OR (sensitivity <= default::Sensitivity.Medium)))) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'Intern', 'Mentor', 'Translator'} INTERSECT GLOBAL default::currentRoles)) AND isMember))
      );
  };
  ALTER TYPE default::Project {
      CREATE ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForProject
          ALLOW DELETE USING ((default::Role.FieldServices IN GLOBAL default::currentRoles));
      ALTER ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProject USING (EXISTS ((<default::Role>{'FieldServices', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)));
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForProject USING ((EXISTS ((<default::Role>{'ConsultantManager', 'ExperienceOperations', 'FieldOperationsDirector', 'FieldServices', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Fundraising', 'Marketing', 'ProjectManager', 'RegionalDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Intern', 'Mentor', 'RegionalDirector', 'FieldOperationsDirector', 'Translator'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
  };
  ALTER TYPE default::Language {
      CREATE ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForLanguage
          ALLOW DELETE, INSERT USING ((default::Role.FieldServices IN GLOBAL default::currentRoles));
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForLanguage USING ((EXISTS ((<default::Role>{'ConsultantManager', 'ExperienceOperations', 'FieldServices', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'Fundraising', 'Marketing', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner', 'Intern', 'Mentor', 'Translator'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
  };
  ALTER TYPE default::Partner {
      ALTER ACCESS POLICY CanDeleteGeneratedFromAppPoliciesForPartner USING (EXISTS ((<default::Role>{'Controller', 'FieldServices'} INTERSECT GLOBAL default::currentRoles)));
      ALTER ACCESS POLICY CanInsertGeneratedFromAppPoliciesForPartner USING (EXISTS ((<default::Role>{'FieldServices', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)));
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForPartner USING (((((EXISTS ((<default::Role>{'ConsultantManager', 'FieldOperationsDirector', 'FieldServices', 'LeadFinancialAnalyst', 'Controller', 'FinancialAnalyst', 'ProjectManager', 'RegionalDirector'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'Consultant', 'ConsultantManager', 'FieldPartner'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)) OR (EXISTS ((<default::Role>{'ExperienceOperations', 'Fundraising'} INTERSECT GLOBAL default::currentRoles)) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))) OR ((default::Role.Marketing IN GLOBAL default::currentRoles) AND ((.isMember AND (.sensitivity <= default::Sensitivity.Medium)) OR (.sensitivity <= default::Sensitivity.Low)))) OR ((default::Role.StaffMember IN GLOBAL default::currentRoles) AND (.sensitivity <= default::Sensitivity.Low))));
  };
  ALTER TYPE default::Partnership {
      ALTER ACCESS POLICY CanInsertDeleteGeneratedFromAppPoliciesForPartnership USING (((EXISTS ((<default::Role>{'FieldOperationsDirector', 'FieldServices', 'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)) OR (EXISTS ((<default::Role>{'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND (.isMember OR (.sensitivity <= default::Sensitivity.Medium)))));
  };
};
