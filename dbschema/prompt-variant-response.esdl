module default {
  type PromptVariantResponse extending Resource, Mixin::Embedded, Mixin::Owned {
    promptId: str;
    multi link responses: VariantResponse {
      on source delete delete target;
    }
  }

  type VariantResponse extending Resource, Mixin::Owned {
    required variant: str;
    response: RichText;
  }
}
