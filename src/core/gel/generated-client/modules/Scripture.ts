// GENERATED by @gel/generate v0.6.2

import * as $ from "../reflection";
import * as _ from "../imports";
import type * as _std from "./std";
import type * as _default from "./default";
export type $CollectionλShape = $.typeutil.flatten<_std.$Object_8ce8c71ee4fa5f73840c22d7eaa58588λShape & {
  "label": $.PropertyDesc<_std.$str, $.Cardinality.One, false, false, true, false>;
  "verses": $.LinkDesc<$VerseRange, $.Cardinality.Many, {}, false, false,  true, false>;
  "ids": $.PropertyDesc<$.MultiRangeType<_std.$number>, $.Cardinality.One, false, true, false, false>;
  "<scripture[is Product]": $.LinkDesc<_default.$Product, $.Cardinality.Many, {}, false, false,  false, false>;
  "<scripture[is DirectScriptureProduct]": $.LinkDesc<_default.$DirectScriptureProduct, $.Cardinality.Many, {}, false, false,  false, false>;
  "<scripture[is DerivativeScriptureProduct]": $.LinkDesc<_default.$DerivativeScriptureProduct, $.Cardinality.Many, {}, false, false,  false, false>;
  "<scriptureOverride[is DerivativeScriptureProduct]": $.LinkDesc<_default.$DerivativeScriptureProduct, $.Cardinality.Many, {}, false, false,  false, false>;
  "<scripture[is Producible]": $.LinkDesc<_default.$Producible, $.Cardinality.Many, {}, false, false,  false, false>;
  "<scripture[is EthnoArt]": $.LinkDesc<_default.$EthnoArt, $.Cardinality.Many, {}, false, false,  false, false>;
  "<scripture[is Film]": $.LinkDesc<_default.$Film, $.Cardinality.Many, {}, false, false,  false, false>;
  "<scripture[is Story]": $.LinkDesc<_default.$Story, $.Cardinality.Many, {}, false, false,  false, false>;
  "<scripture[is OtherProduct]": $.LinkDesc<_default.$OtherProduct, $.Cardinality.Many, {}, false, false,  false, false>;
  "<scripture": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
  "<scriptureOverride": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
}>;
type $Collection = $.ObjectType<"Scripture::Collection", $CollectionλShape, null, [
  ..._std.$Object_8ce8c71ee4fa5f73840c22d7eaa58588['__exclusives__'],
], "Scripture::Collection">;
const $Collection = $.makeType<$Collection>(_.spec, "4b932ad2-01a9-11f0-8e1e-238c25f2b71f", _.syntax.literal);

const Collection: $.$expr_PathNode<$.TypeSet<$Collection, $.Cardinality.Many>, null> = _.syntax.$PathNode($.$toSet($Collection, $.Cardinality.Many), null);

export type $UnspecifiedPortionλShape = $.typeutil.flatten<_std.$Object_8ce8c71ee4fa5f73840c22d7eaa58588λShape & {
  "book": $.PropertyDesc<_std.$str, $.Cardinality.One, false, false, true, false>;
  "totalVerses": $.PropertyDesc<_std.$int16, $.Cardinality.One, false, false, true, false>;
  "<unspecifiedScripture[is DirectScriptureProduct]": $.LinkDesc<_default.$DirectScriptureProduct, $.Cardinality.Many, {}, false, false,  false, false>;
  "<unspecifiedScripture": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
}>;
type $UnspecifiedPortion = $.ObjectType<"Scripture::UnspecifiedPortion", $UnspecifiedPortionλShape, null, [
  ..._std.$Object_8ce8c71ee4fa5f73840c22d7eaa58588['__exclusives__'],
], "Scripture::UnspecifiedPortion">;
const $UnspecifiedPortion = $.makeType<$UnspecifiedPortion>(_.spec, "4b9498b8-01a9-11f0-9adc-f1a406b551ff", _.syntax.literal);

const UnspecifiedPortion: $.$expr_PathNode<$.TypeSet<$UnspecifiedPortion, $.Cardinality.Many>, null> = _.syntax.$PathNode($.$toSet($UnspecifiedPortion, $.Cardinality.Many), null);

export type $VerseλShape = $.typeutil.flatten<_std.$Object_8ce8c71ee4fa5f73840c22d7eaa58588λShape & {
  "verseId": $.PropertyDesc<_std.$int16, $.Cardinality.One, false, false, true, false>;
  "book": $.PropertyDesc<_std.$str, $.Cardinality.One, false, false, true, false>;
  "chapter": $.PropertyDesc<_std.$int16, $.Cardinality.One, false, false, true, false>;
  "verse": $.PropertyDesc<_std.$int16, $.Cardinality.One, false, false, true, false>;
  "label": $.PropertyDesc<_std.$str, $.Cardinality.One, false, true, false, false>;
  "<end[is Scripture::VerseRange]": $.LinkDesc<$VerseRange, $.Cardinality.Many, {}, false, false,  false, false>;
  "<start[is Scripture::VerseRange]": $.LinkDesc<$VerseRange, $.Cardinality.Many, {}, false, false,  false, false>;
  "<end": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
  "<start": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
}>;
type $Verse = $.ObjectType<"Scripture::Verse", $VerseλShape, null, [
  ..._std.$Object_8ce8c71ee4fa5f73840c22d7eaa58588['__exclusives__'],
], "Scripture::Verse">;
const $Verse = $.makeType<$Verse>(_.spec, "4c76dbec-01a9-11f0-a82a-e167c402fce3", _.syntax.literal);

const Verse: $.$expr_PathNode<$.TypeSet<$Verse, $.Cardinality.Many>, null> = _.syntax.$PathNode($.$toSet($Verse, $.Cardinality.Many), null);

export type $VerseRangeλShape = $.typeutil.flatten<_std.$Object_8ce8c71ee4fa5f73840c22d7eaa58588λShape & {
  "label": $.PropertyDesc<_std.$str, $.Cardinality.One, false, false, true, false>;
  "end": $.LinkDesc<$Verse, $.Cardinality.One, {}, false, false,  true, false>;
  "start": $.LinkDesc<$Verse, $.Cardinality.One, {}, false, false,  true, false>;
  "ids": $.PropertyDesc<$.RangeType<_std.$number>, $.Cardinality.One, false, true, false, false>;
  "<verses[is Scripture::Collection]": $.LinkDesc<$Collection, $.Cardinality.Many, {}, false, false,  false, false>;
  "<verses": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
}>;
type $VerseRange = $.ObjectType<"Scripture::VerseRange", $VerseRangeλShape, null, [
  ..._std.$Object_8ce8c71ee4fa5f73840c22d7eaa58588['__exclusives__'],
], "Scripture::VerseRange">;
const $VerseRange = $.makeType<$VerseRange>(_.spec, "4c752bf8-01a9-11f0-8104-4b42786d6830", _.syntax.literal);

const VerseRange: $.$expr_PathNode<$.TypeSet<$VerseRange, $.Cardinality.Many>, null> = _.syntax.$PathNode($.$toSet($VerseRange, $.Cardinality.Many), null);



export { $Collection, Collection, $UnspecifiedPortion, UnspecifiedPortion, $Verse, Verse, $VerseRange, VerseRange };

type __defaultExports = {
  "Collection": typeof Collection;
  "UnspecifiedPortion": typeof UnspecifiedPortion;
  "Verse": typeof Verse;
  "VerseRange": typeof VerseRange
};
const __defaultExports: __defaultExports = {
  "Collection": Collection,
  "UnspecifiedPortion": UnspecifiedPortion,
  "Verse": Verse,
  "VerseRange": VerseRange
};
export default __defaultExports;
