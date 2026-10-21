export const author = {
  select: { id: true, email: true, name: true },
} as const;

export const communitySummary = { select: { id: true, name: true } } as const;
