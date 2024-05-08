CREATE MIGRATION m1s2cbqfqayiw2giggpp3dlfwrxnmpaziw7irc4h74chugwr4noluq
    ONTO m1rxhi72zd43b4hwanwavpsfx7yo5vfngfr4ngmxq4thpuvi3t45qa
{
  ALTER TYPE default::Organization {
      CREATE PROPERTY address: std::str;
  };
  ALTER TYPE default::Partner {
      CREATE PROPERTY address: std::str;
      CREATE PROPERTY startDate: cal::local_date;
  };
};
