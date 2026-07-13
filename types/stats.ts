export type StatsRange = 7 | 30 | 90;

export type StatsDataSource = 'cloud' | 'cached' | 'local';

export interface StatsReviewRow {
  id: string;
  flashcardId: string;
  rating: number;
  reviewedAt: number;
  responseTimeMs: number | null;
  subject: string | null;
}

export interface StatsActivityBucket {
  key: string;
  label: string;
  accessibilityLabel: string;
  count: number;
}

export interface StatsBacklogRow {
  subject: string | null;
  dueAt: number;
}

export interface StatsBacklogSubject {
  name: string;
  count: number;
}

export interface StatsBacklogSummary {
  total: number;
  oldestDueAt: number | null;
  subjects: StatsBacklogSubject[];
}

export interface SubjectPerformance {
  name: string;
  reviews: number;
  recallRate: number | null;
  needsAttention: boolean;
  hasEnoughData: boolean;
}

export interface StatsFocusInsight {
  kind: 'needs-attention' | 'strong' | 'insufficient';
  subject: string | null;
  title: string;
  message: string;
}

export interface StatsSnapshot {
  range: StatsRange;
  dataSource: StatsDataSource;
  totalReviews: number;
  uniqueCards: number;
  recallRate: number | null;
  recallChangePoints: number | null;
  reviewChangePercent: number | null;
  activeDays: number;
  medianResponseTimeMs: number | null;
  activity: StatsActivityBucket[];
  backlog: StatsBacklogSummary;
  subjects: SubjectPerformance[];
  focusInsight: StatsFocusInsight;
}

export interface TodayActivitySnapshot {
  reviewsToday: number;
  focusedReviewTimeMs: number;
  activity: StatsActivityBucket[];
  dataSource: StatsDataSource;
}
