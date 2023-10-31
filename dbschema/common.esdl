module default {
  global currentUserId: uuid;

  scalar type ReportPeriod extending enum<Monthly, Quarterly>;
}
