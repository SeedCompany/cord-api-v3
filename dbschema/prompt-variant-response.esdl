module default {
  type PromptVariantResponse {
    responses := .<uniqueResponse[is VariantResponse];
  }
  
  type VariantResponse {
    required uniqueResponse: PromptVariantResponse;
    required variant: str;
    response: RichText;
  
    constraint exclusive on ((.uniqueResponse, .variant));
  }
}
