CREATE MIGRATION m1pj5borebvxev6umfekcrl6cxhphhacperp3ekduggieospl3xlqq
    ONTO m1gb5s7btpy76oedup56hbchk5exrtz6x74bs6hhzfkzkc5htinl4q
{
  ALTER TYPE default::Project {
      DROP PROPERTY departmentId;
  };
};
