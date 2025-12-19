CREATE MIGRATION m1jijhhv6wfb5l6pxb65ubr2y4on3mxkdrhufizmpmirid4hadso3a
    ONTO m1mpcychq5xznpqjnhf67qt7oasbo222voatcf23xm4wjaojlnzd2a
{
  ALTER SCALAR TYPE default::Role EXTENDING enum<Administrator, BetaTester, BibleTranslationLiaison, Consultant, ConsultantManager, Controller, ExperienceOperations, FieldOperationsDirector, FieldPartner, FinancialAnalyst, Fundraising, Intern, LeadFinancialAnalyst, Leadership, Liaison, Marketing, Mentor, ProjectManager, RegionalCommunicationsCoordinator, RegionalDirector, StaffMember, Translator, MultiplicationFinanceApprover, FieldServices>;
};
