export const PAGE_SIZE = 10;

export type Page<T> = { items: T[]; nextCursor: string | null };
