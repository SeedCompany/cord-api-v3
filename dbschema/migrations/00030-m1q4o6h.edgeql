CREATE MIGRATION m1q4o6hxlasmvjestjii64p3kkzuvxon626xo4hykuwahicdrcxvta
    ONTO m1stuiewjnhrznhwslwjqll7jd3rattughkehe3krd4oegtezhclka
{
  CREATE SCALAR TYPE Tool::Key EXTENDING enum<Rev79>;
  ALTER TYPE default::Tool {
      CREATE OPTIONAL PROPERTY key: Tool::Key {
          CREATE CONSTRAINT std::exclusive;
      };
  };
};
