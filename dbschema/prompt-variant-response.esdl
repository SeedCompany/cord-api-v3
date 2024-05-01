module Prompt {
  abstract type PromptVariantResponse extending default::Resource, Mixin::Embedded {
    annotation description := "An instance of a prompt and the responses per variant.";

    promptId: default::nanoid;
    responses := .<pvr[is VariantResponse];
  }

  type VariantResponse extending Mixin::Audited {
    annotation description := "A response (for a variant) to an instance of a prompt.";

    required pvr: PromptVariantResponse;
    required variant: str;
    response: default::RichText;

    constraint exclusive on ((.pvr, .variant));
  }
}
