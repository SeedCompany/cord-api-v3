CREATE MIGRATION m1hn3c7dprlsrrefs56alty2y4q475cofaqt3qd5okdmo3cj5uly4a
    ONTO m1xzmkyesmqv2ivg4gjj6zmh5kdalfwgndnst356xk4i524hvyibtq
{
  ALTER SCALAR TYPE Organization::Type EXTENDING enum<Church, Parachurch, Mission, Translation, Alliance>;
};
