# Database Details for CramItFinal

This document describes the database schema for the CramItFinal application, managed using Prisma.

## Overview

The database is PostgreSQL, as specified in the `datasource db` block in `prisma/schema.prisma`. Prisma Client is used as the ORM to interact with the database from the backend.

## Prisma Schema (`prisma/schema.prisma`)

```prisma
// This is your Prisma schema file,
// learn more about it in the docs: https://pris.ly/d/prisma-schema

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                String   @id @default(cuid())
  email             String   @unique
  name              String?
  phone             String?
  isPremium         Boolean  @default(false)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt

  decks             Deck[]
  flashcardStatuses UserFlashcardStatus[] // Relation to user-specific flashcard data
}

model Deck {
  id          String    @id @default(cuid())
  name        String
  description String?
  tags        String[]  @default([])
  isPremium   Boolean   @default(false)
  price       Float?
  coverImage  String?
  subject     String?
  chapter     String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  userId      String    // Foreign key to User
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  flashcards  Flashcard[] // Relation to flashcards in this deck
}

model Flashcard {
  id          String   @id @default(cuid())
  front       String
  back        String
  contentType String   // e.g., 'text', 'latex', 'image'
  mediaUrls   String[] @default([])
  tags        String[] @default([])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  deckId      String   // Foreign key to Deck
  deck        Deck     @relation(fields: [deckId], references: [id], onDelete: Cascade)
  userStatuses UserFlashcardStatus[] // Relation to user-specific status for this card
}

model UserFlashcardStatus {
  id           String    @id @default(cuid())
  userId       String
  flashcardId  String
  user         User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  flashcard    Flashcard @relation(fields: [flashcardId], references: [id], onDelete: Cascade)

  // User-specific SRS fields
  interval     Int       @default(1)     // Days until next review
  easeFactor   Float     @default(2.5)   // How easy the card is
  repetitions  Int       @default(0)     // Number of times reviewed
  dueDate      DateTime  @default(now())  // Timestamp when card is due
  lastReviewed DateTime?                 // Timestamp of last review
  
  // Additional user-specific metadata
  isBookmarked Boolean   @default(false)
  isLearned    Boolean   @default(false) // Tracks if user explicitly marked as learned
  isDeleted    Boolean   @default(false) // For soft-deleting a card from a user's view/queue

  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  @@unique([userId, flashcardId]) // Ensures a user has only one status per flashcard
}

// Comments regarding UserStudyStats and ContentTypeEnum from original schema are omitted for brevity here
// but are good considerations for future development.
```

## Key Models and Relationships

### `User`
- Represents an application user.
- Identified by `id` and `email` (unique).
- Contains basic profile information (`name`, `phone`, `isPremium`).
- **Relations:**
    - Has many `Deck`s (one-to-many: a user can create multiple decks).
    - Has many `UserFlashcardStatus` records (one-to-many: a user has status for multiple flashcards).

### `Deck`
- Represents a collection of flashcards.
- Contains metadata like `name`, `description`, `tags`, etc.
- **Relations:**
    - Belongs to one `User` (many-to-one: a deck is created by a single user).
        - `userId` is the foreign key.
        - `onDelete: Cascade` means if a `User` is deleted, their `Deck`s are also deleted.
    - Has many `Flashcard`s (one-to-many: a deck can contain multiple flashcards).

### `Flashcard`
- Represents a single flashcard with a `front` and `back`.
- Contains metadata like `contentType`, `mediaUrls`, `tags`.
- **Relations:**
    - Belongs to one `Deck` (many-to-one: a flashcard is part of a single deck).
        - `deckId` is the foreign key.
        - `onDelete: Cascade` means if a `Deck` is deleted, its `Flashcard`s are also deleted.
    - Has many `UserFlashcardStatus` records (one-to-many: a flashcard can have status records for multiple users, enabling sharing scenarios).

### `UserFlashcardStatus`
- **Purpose:** This is a crucial join-like table that stores user-specific data for each flashcard a user interacts with.
- It links a `User` to a `Flashcard`.
- **Contains:**
    - Spaced Repetition System (SRS) fields: `interval`, `easeFactor`, `repetitions`, `dueDate`, `lastReviewed`.
    - User-specific metadata: `isBookmarked`, `isLearned`, `isDeleted` (for soft deletes).
- **Relations:**
    - Belongs to one `User` (`userId` foreign key, `onDelete: Cascade`).
    - Belongs to one `Flashcard` (`flashcardId` foreign key, `onDelete: Cascade`).
- **Constraint:** `@@unique([userId, flashcardId])` ensures that a user can only have one status record for any given flashcard.

## Data Integrity
- **Cascade Deletes:** The schema uses `onDelete: Cascade` for most relations. This means:
    - Deleting a `User` will delete their `Deck`s and their `UserFlashcardStatus` records.
    - Deleting a `Deck` will delete its `Flashcard`s.
    - Deleting a `Flashcard` will delete its associated `UserFlashcardStatus` records.
    - This needs careful consideration in application logic if soft deletes or orphaned records are ever desired for specific scenarios (though `UserFlashcardStatus.isDeleted` handles soft deletes from a user's perspective).

## Migrations
- Database schema changes are managed using Prisma Migrate (`npx prisma migrate dev`).
- Migration files are stored in the `prisma/migrations/` directory.

This document should be updated if the Prisma schema changes. 