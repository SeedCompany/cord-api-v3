CREATE MIGRATION m1zvgtl6fsi4h7kuyygotlso3rrvgaidyqep6glwsibn5njizku6yq
    ONTO m1i5xxrzlqttad2poopmmfzevp4wib72p64xoqxexz5j2rlxhlxyga
{
  DROP FUNCTION default::str_trim_or_none(string: std::str);
  ALTER TYPE default::Language {
      CREATE MULTI LINK engagements := (.<language[IS default::LanguageEngagement]);
  };
};
