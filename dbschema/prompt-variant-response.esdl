module default {
  type PromptVariantResponse extending Resource, Mixin::Embedded, Mixin::Owned {
    required promptId: str;
    # TODO - make the items in the list unique
    multi link responses: VariantResponse {
      on source delete delete target;
    }
  }

  type VariantResponse extending Mixin::Timestamped, Mixin::Owned {
    required variant: str;
    response: RichText;
  }
}
