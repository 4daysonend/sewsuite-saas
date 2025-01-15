export interface PaginationOptions {
  page: number;
  limit: number;
}

export interface Pagination<T> {
  items: T[];
  meta: {
    totalItems: number;
    itemCount: number;
    itemsPerPage: number;
    totalPages: number;
    currentPage: number;
  };
}
