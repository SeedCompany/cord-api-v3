CREATE MIGRATION m1zasaruu7gg245gjtxbbvqt5t4mh5c2zf5qvq5bvyihhw37uns3ta
    ONTO m1oatla3xkxgpqdkclpj7rxmrcimqfnp5ikwfrdco4muttq5jrfy2a
{
  CREATE MODULE Comments IF NOT EXISTS;
  CREATE MODULE Post IF NOT EXISTS;
  CREATE ABSTRACT TYPE Comments::Aware EXTENDING default::Resource;
  CREATE ABSTRACT TYPE Mixin::Postable EXTENDING default::Resource;
  ALTER TYPE default::Project EXTENDING Mixin::Postable,
  Comments::Aware BEFORE default::Resource;
  CREATE TYPE Comments::Thread EXTENDING default::Resource, Mixin::Embedded {
      ALTER LINK container {
          SET SINGLE;
          ON TARGET DELETE DELETE SOURCE;
          SET OWNED;
          SET REQUIRED;
          SET TYPE Comments::Aware USING (<Comments::Aware>{});
      };
  };
  ALTER TYPE Comments::Aware {
      CREATE LINK commentThreads := (.<container[IS Comments::Thread]);
  };
  CREATE TYPE Comments::Comment EXTENDING default::Resource {
      CREATE REQUIRED LINK thread: Comments::Thread {
          ON TARGET DELETE DELETE SOURCE;
      };
      CREATE REQUIRED PROPERTY body: default::RichText;
  };
  ALTER TYPE Comments::Thread {
      CREATE LINK comments := (.<thread[IS Comments::Comment]);
      CREATE LINK firstComment := (SELECT
          .comments ORDER BY
              .createdAt ASC
      LIMIT
          1
      );
      CREATE LINK latestComment := (SELECT
          .comments ORDER BY
              .createdAt DESC
      LIMIT
          1
      );
  };
  ALTER TYPE default::Language EXTENDING Mixin::Postable BEFORE default::Resource;
  ALTER TYPE default::Partner EXTENDING Mixin::Postable BEFORE default::Resource;
  CREATE SCALAR TYPE Post::Shareability EXTENDING enum<Membership, Internal, AskToShareExternally, External>;
  CREATE SCALAR TYPE Post::Type EXTENDING enum<Note, Story, Prayer>;
  CREATE TYPE default::Post EXTENDING default::Resource, Mixin::Embedded {
      ALTER LINK container {
          SET SINGLE;
          ON TARGET DELETE DELETE SOURCE;
          SET OWNED;
          SET REQUIRED;
          SET TYPE Mixin::Postable USING (<Mixin::Postable>{});
      };
      CREATE SINGLE PROPERTY isMember := (.container[IS Project::ContextAware].isMember);
      CREATE SINGLE PROPERTY sensitivity := (.container[IS Project::ContextAware].sensitivity);
      CREATE REQUIRED PROPERTY body: default::RichText;
      CREATE REQUIRED PROPERTY shareability: Post::Shareability;
      CREATE REQUIRED PROPERTY type: Post::Type;
  };
  ALTER TYPE Mixin::Postable {
      CREATE LINK posts := (.<container[IS default::Post]);
  };
};
