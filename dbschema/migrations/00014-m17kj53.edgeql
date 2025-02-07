CREATE MIGRATION m17kj53oeiwfhu7koyyzyygsb4apymrj7lu2uecongecvkxfivkpcq
    ONTO m1zitdbhkuio47b5dgcro6do27hn7jjlc2iosjmt4ayzkmwp4wqu2q
{
  ALTER SCALAR TYPE Engagement::AIAssistedTranslation EXTENDING enum<Unknown, None, Drafting, Checking, DraftCheck, Other>;
};
