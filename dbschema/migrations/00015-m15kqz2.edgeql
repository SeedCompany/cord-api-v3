CREATE MIGRATION m1utvbds2exzhugn4zdm3dajyq2oqgookth5fi5gnb5u4ka4yfryxq
    ONTO m1l7uuqm3my5klng3a2m6wqoswaq63h6jb63gvioafpj2t5yffxduq
{
  CREATE GLOBAL default::impersonatedRoles -> array<default::Role>;
  ALTER GLOBAL default::currentRoles USING (((GLOBAL default::currentActor).roles UNION std::array_unpack(GLOBAL default::impersonatedRoles)));
};
