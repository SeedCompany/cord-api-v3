// GENERATED by @gel/generate v0.6.2

import * as $ from "../reflection";
import * as _ from "../imports";
export type $Reach = {
  "Local": $.$expr_Literal<$Reach>;
  "Regional": $.$expr_Literal<$Reach>;
  "National": $.$expr_Literal<$Reach>;
  "Global": $.$expr_Literal<$Reach>;
} & $.EnumType<"Organization::Reach", ["Local", "Regional", "National", "Global"]>;
const Reach: $Reach = $.makeType<$Reach>(_.spec, "47c49062-01a9-11f0-a8d7-5304b0392527", _.syntax.literal);

export type $Type = {
  "Church": $.$expr_Literal<$Type>;
  "Parachurch": $.$expr_Literal<$Type>;
  "Mission": $.$expr_Literal<$Type>;
  "TranslationOrganization": $.$expr_Literal<$Type>;
  "Alliance": $.$expr_Literal<$Type>;
} & $.EnumType<"Organization::Type", ["Church", "Parachurch", "Mission", "TranslationOrganization", "Alliance"]>;
const Type: $Type = $.makeType<$Type>(_.spec, "47c4a32c-01a9-11f0-9d8f-cd89fe60f5f3", _.syntax.literal);



export { Reach, Type };

type __defaultExports = {
  "Reach": typeof Reach;
  "Type": typeof Type
};
const __defaultExports: __defaultExports = {
  "Reach": Reach,
  "Type": Type
};
export default __defaultExports;
