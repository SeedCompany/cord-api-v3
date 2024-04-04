CREATE MIGRATION m12c4p2sdcptmmojgywktqsmk5aldxgbiwn26ipq5jxs7uuwksqw2a
    ONTO m1uod3hyqn64tbkbnyve7ec7ny6l67wuueaoa4juxqol4gjbtq4euq
{
  CREATE TYPE ProgressReport::CommunityStory EXTENDING ProgressReport::Child, Prompt::PromptVariantResponse {
      ALTER LINK container {
          SET OWNED;
          SET TYPE default::ProgressReport USING (<default::ProgressReport>{});
      };
  };
  CREATE TYPE ProgressReport::Highlight EXTENDING ProgressReport::Child, Prompt::PromptVariantResponse {
      ALTER LINK container {
          SET OWNED;
          SET TYPE default::ProgressReport USING (<default::ProgressReport>{});
      };
  };
  CREATE TYPE ProgressReport::TeamNews EXTENDING ProgressReport::Child, Prompt::PromptVariantResponse {
      ALTER LINK container {
          SET OWNED;
          SET TYPE default::ProgressReport USING (<default::ProgressReport>{});
      };
  };
};
