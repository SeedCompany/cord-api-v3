CREATE MIGRATION m1zewkih6hvqg45awyqrglwi56htph4iipv3adh4mx46dtddp4a5ka
    ONTO m1xp5mbrgbcsdkvhimirvlj2hueu7m7aeyowjcp3wl4itrzityln4q
{
  CREATE TYPE Organization::AllianceMembership {
      CREATE REQUIRED LINK alliance: default::Organization;
      CREATE REQUIRED LINK member: default::Organization;
      CREATE CONSTRAINT std::exclusive ON ((.member, .alliance));
      CREATE REQUIRED PROPERTY joinedAt: std::cal::local_date;
  };
  ALTER TYPE default::Organization {
      CREATE MULTI LINK allianceMembers: Organization::AllianceMembership;
      CREATE MULTI LINK joinedAlliances: Organization::AllianceMembership;
      CREATE LINK parent: default::Organization;
  };
};
