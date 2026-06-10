CREATE MIGRATION m1tke26ax46htd7teqg7osvjmo24rx3g2hjt3qecpjhfbz534ovdoq
    ONTO m1eossglz2cv4x6zc656qq5xft3axauywf4t7znhyklv4mrbfngsiq
{
  ALTER TYPE default::PeriodicReport {
      CREATE LINK narrativeFile: default::File;
      CREATE PROPERTY narrativeReceivedDate: std::cal::local_date;
  };
};
