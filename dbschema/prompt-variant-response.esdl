module Prompt {
  type PromptVariantResponse extending default::Resource, Mixin::Embedded, Mixin::Owned {
    annotation description := "An instance of a prompt and the responses per variant.";

    promptId: str;
    responses := .<pvr[is VariantResponse];
  }

  type VariantResponse extending Mixin::Timestamped, Mixin::Owned {
    annotation description := "A response (for a variant) to an instance of a prompt.";

    required pvr: PromptVariantResponse;
    required variant: str;
    response: default::RichText;

    constraint exclusive on ((.pvr, .variant));
  }
}
