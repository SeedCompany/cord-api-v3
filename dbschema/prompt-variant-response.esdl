module default {
  type PromptVariantResponse extending Resource {
    creator: User;
    multi link responses := VariantResponse;
  }

  abstract type VariantResponse extending Resource {
    variant: VariantResponse::Variant;
    response: RichText;
    creator: User;
  }
  
  type PromptResponse extending Resource {
    parent: str;
    prompt: Prompt;
    response: RichText;
  }
  
  type Prompt extending Resource {
    text: RichText;
    shortLabel: str;
    min: int16;
    max: int16; 
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
