module default {
  type PaginationInput {
    required count: int16 {
      constraint min_value(1);
      constraint max_value(100);
      default := 25;
    };
   
    page: int16 {
      constraint min_value(1);
      default := 1;
    };
  }

  type ProductCompletionDescription extending PaginationInput {
    query: str;
    methodology: Product::Methodology;
  }
}