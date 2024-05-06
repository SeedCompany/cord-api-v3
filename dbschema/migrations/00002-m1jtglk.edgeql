CREATE MIGRATION m1jtglkzb7fc5jezkxnximpq4uqqykdyevfvsnkzf26fv4ouxv274a
    ONTO m13xep3dlmh5po2lifdg2sqasl556k5zfzyeyj7j2pc4u4z5rlouia
{
  ALTER TYPE default::User EXTENDING Mixin::Owned LAST;
  ALTER TYPE default::User {
      ALTER ACCESS POLICY CanSelectUpdateReadGeneratedFromAppPoliciesForUser USING (WITH
          givenRoles := 
              (<default::User>GLOBAL default::currentUserId).roles
      SELECT
          ((EXISTS ((<default::Role>{'Administrator', 'Consultant', 'ConsultantManager', 'FieldPartner', 'FinancialAnalyst', 'LeadFinancialAnalyst', 'Controller', 'Marketing', 'Fundraising', 'ExperienceOperations', 'Leadership', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector', 'StaffMember'} INTERSECT givenRoles)) OR (.isOwner ?? false)) OR (EXISTS ((<default::Role>{'Intern', 'Mentor'} INTERSECT givenRoles)) AND EXISTS ({'Stubbed .isMember for User/Unavailability'})))
      );
  };
};
