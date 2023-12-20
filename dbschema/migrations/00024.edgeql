CREATE MIGRATION m175xjn2wd5kwp5rqzuhwvnorgz56d5okl3x3zxiogsdlbzp23mh4a
    ONTO m1fwq4yhnz7uisuchd4tgim3dsgmvo725eif7qfi7pwx3cxegq4cfq
{
  ALTER TYPE default::User {
      ALTER PROPERTY timezone {
          SET default := 'America/Chicago';
          SET REQUIRED USING ('America/Chicago');
      };
  };
};
