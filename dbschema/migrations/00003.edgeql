CREATE MIGRATION m1et3ppsjarrorq4ftbulmiglk4euz7momla2zt4fdinxxzba57wlq
    ONTO m1m7pnl7vcffolzatfunjjqjdbdzezj6tl3u6zqp3zdtwmx54rtlpa
{
  ALTER TYPE Engagement::Resource {
      CREATE TRIGGER enforceEngagementProject
          AFTER UPDATE, INSERT 
          FOR EACH DO (std::assert((__new__.project = __new__.engagement.project)));
  };
};
