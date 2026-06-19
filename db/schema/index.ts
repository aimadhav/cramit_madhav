import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

// --- TABLES ---

/**
 * Sync Queue: Event-based sync mechanism (Issue 2)
 */
export const syncQueue = sqliteTable('sync_queue', {
  id: text('id').primaryKey(),
  operation: text('operation').notNull(), // 'CREATE', 'UPDATE', 'DELETE', 'REVIEW'
  entityType: text('entity_type').notNull(), // 'deck', 'card_status', 'review'
  entityId: text('entity_id').notNull(),
  payload: text('payload').notNull(), // JSON blob of the change
  status: text('status').default('pending'), // 'pending', 'synced', 'failed'
  retryCount: integer('retry_count').default(0),
  lastError: text('last_error'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

/**
 * Decks: Local storage for owned and downloaded decks (Issue 5 & 6)
 */
export const decks = sqliteTable('decks', {
  id: text('id').primaryKey(), // local ID
  remoteId: text('remote_id'), // Link to Supabase ID
  name: text('name').notNull(),
  description: text('description'),
  subject: text('subject'),
  chapter: text('chapter'),
  coverImage: text('cover_image'),
  version: integer('version').default(1), // Deck Versioning
  
  // New categorization fields
  isPublic: integer('is_public', { mode: 'boolean' }).default(true),
  prepCategory: text('prep_category'),
  
  // Metadata
  isDownloaded: integer('is_downloaded', { mode: 'boolean' }).default(false),
  downloadedAt: integer('downloaded_at'),
  isPremium: integer('is_premium', { mode: 'boolean' }).default(false),
  userId: text('user_id'), // Owner ID from Supabase
  
  tags: text('tags').default('[]'), // JSON string of tags
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
});

/**
 * Flashcards: The static content (Issue 3)
 */
export const flashcards = sqliteTable('flashcards', {
  id: text('id').primaryKey(),
  deckId: text('deck_id').notNull(),
  
  // JSON structure for mixed content (text + latex + image)
  frontContent: text('front_content').notNull(), 
  backContent: text('back_content').notNull(),
  
  startingStability: real('starting_stability').default(0),
  
  mediaUrls: text('media_urls').default('[]'),
  tags: text('tags').default('[]'), // JSON string of tags for formulas, concepts, etc.
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
});

/**
 * User Flashcard Status: Current FSRS state (Issue 1)
 */
export const userFlashcardStatus = sqliteTable('user_flashcard_status', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  flashcardId: text('flashcard_id').notNull(),
  
  // FSRS Core Data
  interval: integer('interval').default(1),
  stability: real('stability').default(0),
  difficulty: real('difficulty').default(0),
  repetitions: integer('repetitions').default(0),
  due_date: integer('due_date').notNull(), 
  lastReviewed: integer('last_reviewed'), 
  
  isBookmarked: integer('is_bookmarked', { mode: 'boolean' }).default(false),
  notes: text('notes'),
  
  // Tracking swipes for mistakes and analytics
  leftSwipes: integer('left_swipes').default(0),
  rightSwipes: integer('right_swipes').default(0),
  lastSwipeDirection: text('last_swipe_direction'),

  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
}, (table) => ({
  dueIdx: index('due_date_idx').on(table.due_date),
  userCardIdx: uniqueIndex('user_card_idx').on(table.userId, table.flashcardId),
}));

/**
 * Reviews: Historical review events (Issue 1)
 */
export const reviews = sqliteTable('reviews', {
  id: text('id').primaryKey(),
  flashcardId: text('flashcard_id').notNull(),
  userId: text('user_id').notNull(),
  
  rating: integer('rating').notNull(), // 1-4 (Again, Hard, Good, Easy)
  reviewedAt: integer('reviewed_at').notNull(),
  responseTimeMs: integer('response_time_ms'),
  
  // FSRS state transition data
  previousStability: real('previous_stability'),
  newStability: real('new_stability'),
  previousDifficulty: real('previous_difficulty'),
  newDifficulty: real('new_difficulty'),
  
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
});

/**
 * Study Sessions: Aggregate stats
 */
export const studySessions = sqliteTable('study_sessions', {
  id: text('id').primaryKey(),
  deckId: text('deck_id').notNull(),
  userId: text('user_id').notNull(),
  startTime: integer('start_time').notNull(),
  endTime: integer('end_time'),
  cardsStudied: integer('cards_studied').default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
});

/**
 * Rooms: Local cache of joined rooms
 */
export const rooms = sqliteTable('rooms', {
  id: text('id').primaryKey(),
  code: text('code').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  createdBy: text('created_by'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
  deletedAt: integer('deleted_at'),
}, (table) => ({
  codeIdx: index('room_code_idx').on(table.code),
}));

/**
 * User Active Chapters: Tracks which chapters (decks) the user is actively studying for each subject.
 */
export const userActiveChapters = sqliteTable('user_active_chapters', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  deckId: text('deck_id').notNull(), // Chapter deck ID
  subject: text('subject').notNull(),
  status: text('status').default('active'), // 'active' | 'completed'
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
}, (table) => ({
  userChapterIdx: uniqueIndex('user_chapter_idx').on(table.userId, table.deckId),
}));
