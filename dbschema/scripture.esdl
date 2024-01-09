module Scripture {
  type Collection {
    required label: str {
      readonly := true;
    }
    # Want to allow optional for now for DerivativeScriptureProduct's scripture override use-case
    multi verses: VerseRange {
      readonly := true;
      on source delete delete target if orphan;
    }
    ids := multirange(array_agg(.verses.ids));
  }
  
  type VerseRange {
    required label: str {
      readonly := true;
    }
    required `start`: Verse {
      readonly := true;
      on source delete delete target if orphan;
    }
    required `end`: Verse {
      readonly := true;
      on source delete delete target if orphan;
    }
    ids := range(
      <int32>.`start`.verseId,
      <int32>.`end`.verseId,
      inc_upper := true
    );
  }
  
  type Verse {
    label := .book ++ " " ++ <str>.chapter ++ ":" ++ <str>.verse;
    required book: str {
      readonly := true;
    }
    required chapter: int16 {
      readonly := true;
      constraint min_value(1);
      constraint max_value(150); # Psalms
    }
    required verse: int16 {
      readonly := true;
      constraint min_value(1);
      constraint max_value(176); # Psalms 119
    }
    required verseId: int16 {
      readonly := true;
      constraint min_value(0);
      constraint max_value(31101);
    }
  }
}
