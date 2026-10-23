import type {
  ReportCategory,
  ReportStatus,
} from '../../prisma/generated/client';

const reporterStatusLabels: Record<
  ReportStatus,
  (category: ReportCategory) => string
> = {
  todo: () => 'Received',
  in_progress: () => 'Being worked on',
  done: (category) => {
    if (category === 'bug') return 'Fixed';
    if (category === 'idea') return 'Added';
    return 'Resolved';
  },
};

export function getReporterStatusLabel(
  status: ReportStatus,
  category: ReportCategory,
): string {
  return reporterStatusLabels[status](category);
}
