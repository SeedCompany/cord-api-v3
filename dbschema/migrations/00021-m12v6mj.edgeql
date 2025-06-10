CREATE MIGRATION m12v6mjpnma3kdngompvtea3ldgqtcpm45b2wcjxwvt5jxyu53zsuq
    ONTO m17rl5lo5wwq63duwmpqjtdqfuhq3luocyigofuobamdcu6l4dlepq
{
  ALTER TYPE Project::Member {
      CREATE PROPERTY inactiveAt: std::datetime;
      CREATE PROPERTY active := (NOT (EXISTS (.inactiveAt)));
      CREATE TRIGGER enforceValidDates
          AFTER UPDATE 
          FOR EACH DO (std::assert(((__new__.inactiveAt >= __new__.createdAt) OR NOT (EXISTS (__new__.inactiveAt))), message := 'Inactive point must be after the created point'));
  };
};
