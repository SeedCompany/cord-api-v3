CREATE MIGRATION m1xhtylawlv6ksvlfkuw6bien5fobo6mtlj3xgr33uya6hnhcnmn7a
    ONTO m1asch4l54f7eltalgtn3ft3kbtgzascsjujcjnonx6yloej5ujkpa
{
  alter type default::Project {
    alter property departmentId {
      drop rewrite update;
    };
  };
};
