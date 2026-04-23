export interface PaginationInput {
  page: number;
  count: number;
}

export function paginateQuery(input: PaginationInput) {
  return {
    limit: input.count,
    offset: (input.page - 1) * input.count,
  };
}
