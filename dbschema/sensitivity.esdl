module default {
  scalar type Sensitivity extending enum<Low, Medium, High>;
  
  # This seems to work without consequences. To be safe though, probably shouldn't use this in schema yet.
  scalar type Sens extending Sensitivity;
}
