CREATE MIGRATION m1ofy7rouw7ds3bf4744tx7zezojejcwnbv5ophzryg42jelmd43ua
    ONTO m1ded7eefz3g2wv23gyw6izmawdnbqfiulwqhtmcgfc3yrnv3dgaba
{
  CREATE ABSTRACT TYPE Notification::ProjectTransition EXTENDING default::Notification {
      CREATE REQUIRED LINK workflowEvent: Project::WorkflowEvent {
          ON TARGET DELETE DELETE SOURCE;
      };
      CREATE REQUIRED PROPERTY previousStep: Project::Step;
  };
  CREATE TYPE Notification::ProjectTransitionRequiringFinancialApproval EXTENDING Notification::ProjectTransition;
  CREATE TYPE Notification::ProjectTransitionViaMembership EXTENDING Notification::ProjectTransition;
};
