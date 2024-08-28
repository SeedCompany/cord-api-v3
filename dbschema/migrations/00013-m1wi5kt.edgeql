CREATE MIGRATION m1wi5ktrz2nhc2nd4nqdedbhronuklnbkz3dk7jexegedolhtrruoq
    ONTO m1ah2npzra5pek4sq777ow5uvmwuxeediqm5kp2x2zek2zlyjdwg5q
{
  ALTER TYPE ProgressReport::CommunityStory {
      ALTER ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProgressReportCommunityStory USING ((EXISTS ((<default::Role>{'Administrator', 'Marketing'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'FieldPartner', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
  };
  ALTER TYPE ProgressReport::Highlight {
      ALTER ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProgressReportHighlight USING ((EXISTS ((<default::Role>{'Administrator', 'Marketing'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'FieldPartner', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
  };
  ALTER TYPE ProgressReport::TeamNews {
      ALTER ACCESS POLICY CanInsertGeneratedFromAppPoliciesForProgressReportTeamNews USING ((EXISTS ((<default::Role>{'Administrator', 'Marketing'} INTERSECT GLOBAL default::currentRoles)) OR (EXISTS ((<default::Role>{'FieldPartner', 'ProjectManager', 'RegionalDirector', 'FieldOperationsDirector'} INTERSECT GLOBAL default::currentRoles)) AND .isMember)));
  };
};
