module default {
  type PromptVariantResponse extending Resource {
    creator: User;
    multi link responses := VariantResponse;
  }

  abstract type VariantResponse extending Resource {
    variant: VariantResponse::Variant {
      default := VariantResponse::Variant.draft;
    }
    response: RichText;
    creator: User; # Need to figure out if there is a way to reuse the above creator here
  }
}

module VariantResponse {
  scalar type Variant extending enum<
    draft,
    translated,
    fpm,
    published,
  >;
}
