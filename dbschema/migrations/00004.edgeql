CREATE MIGRATION m1unudoy7u4j3s2waa5jadkb43qedra7r6eab3ndzk22fhf4p5bfwq
    ONTO m1et3ppsjarrorq4ftbulmiglk4euz7momla2zt4fdinxxzba57wlq
{
  ALTER TYPE Engagement::Resource {
      ALTER TRIGGER enforceEngagementProject USING (std::assert((__new__.engagement.project = __new__.project), message := 'Given engagement must be for the same project as the given project.'));
  };
};
