export const qk = {
  accounts:      (s: string) => ['sheet', s, 'accounts'] as const,
  snapshots:     (s: string) => ['sheet', s, 'snapshots'] as const,
  categoryMeta:  ()          => ['categoryMeta'] as const,
  config:        (s: string) => ['sheet', s, 'config'] as const,
  tags:          (s: string) => ['sheet', s, 'tags'] as const,
  groups:        (s: string) => ['sheet', s, 'groups'] as const,
  optCompanies:  (s: string) => ['sheet', s, 'option_companies'] as const,
  optGrants:     (s: string) => ['sheet', s, 'option_grants'] as const,
  optFmv:        (s: string) => ['sheet', s, 'option_fmv'] as const,
  optExercises:  (s: string) => ['sheet', s, 'option_exercises'] as const,
  sheetsList:    ()          => ['drive', 'sheets'] as const,
};
