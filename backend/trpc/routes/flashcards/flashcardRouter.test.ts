import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { PrismaClient, type User as PrismaUserType, Deck, Flashcard } from '@prisma/client';
import { flashcardRouter } from './router'; // Assuming flashcardRouter is exported from router.ts
import { mockAuthGetUser, createCallerForTest } from '../../../../tests/testUtils'; 
import { getPrismaClient, _TEST_ONLY_disconnectAndResetPrismaClient } from '../../../prisma/client'; // Import the reset function
// Note: createCallerForTest uses appRouter, ensure testUtils has appRouter import configured correctly

// Define User IDs and Tokens for test users
const USER_A_ID = 'user-a-test-id';
const USER_A_TOKEN = 'mock-user-a-token';
const USER_B_ID = 'user-b-test-id';
const USER_B_TOKEN = 'mock-user-b-token';
const ADMIN_USER_ID = 'admin-test-id-flashcard'; // Unique ID for this test suite's admin
const ADMIN_TOKEN = 'mock-admin-token-flashcard';

let prismaTestClient: PrismaClient;
let userA: PrismaUserType;
let userB: PrismaUserType;
let adminUser: PrismaUserType; // For creating public decks/cards

// Variables to hold created test data
let userADeck: Deck;
let adminPublicDeck: Deck;
let userAFlashcard1: Flashcard; // In userADeck
let adminPublicFlashcard1: Flashcard; // In adminPublicDeck

beforeAll(async () => {
  await _TEST_ONLY_disconnectAndResetPrismaClient();
  prismaTestClient = getPrismaClient();
});

beforeEach(async () => {
  // Clear tables first to ensure clean state and no FK issues during delete
  await prismaTestClient.userFlashcardStatus.deleteMany({});
  await prismaTestClient.flashcard.deleteMany({});
  await prismaTestClient.deck.deleteMany({});
  await prismaTestClient.user.deleteMany({});

  // Seed Users (let Prisma generate IDs)
  userA = await prismaTestClient.user.create({
    data: {
      email: 'usera@example.test',
      name: 'User A',
      isAdmin: false,
    },
  });

  userB = await prismaTestClient.user.create({
    data: {
      email: 'userb@example.test',
      name: 'User B',
      isAdmin: false,
    },
  });

  adminUser = await prismaTestClient.user.create({
    data: {
      email: 'admin-flashcard@example.test', 
      name: 'Admin User for Flashcards',
      isAdmin: true,
    },
  });
  
  // Configure mockAuthGetUser AFTER users are created, using their generated IDs
  mockAuthGetUser.mockReset();
  mockAuthGetUser.mockImplementation(async (token?: string) => {
    if (token === USER_A_TOKEN) return { data: { user: { id: userA.id, email: userA.email } as any }, error: null };
    if (token === USER_B_TOKEN) return { data: { user: { id: userB.id, email: userB.email } as any }, error: null };
    if (token === ADMIN_TOKEN) return { data: { user: { id: adminUser.id, email: adminUser.email } as any }, error: null };
    return { data: { user: null }, error: null };
  });

  // Seed Decks (using generated user IDs)
  userADeck = await prismaTestClient.deck.create({
    data: {
      name: "User A's Private Deck",
      userId: userA.id,
      isPublic: false,
    }
  });

  adminPublicDeck = await prismaTestClient.deck.create({
    data: {
      name: "Admin's Public Deck",
      userId: adminUser.id,
      isPublic: true,
    }
  });

  // Seed Flashcards and initial statuses
  userAFlashcard1 = await prismaTestClient.flashcard.create({
    data: {
      front: "User A Card 1 Front",
      back: "User A Card 1 Back",
      deckId: userADeck.id,
      contentType: 'text',
    }
  });
  await prismaTestClient.userFlashcardStatus.create({
    data: {
      userId: userA.id,
      flashcardId: userAFlashcard1.id,
      isDeleted: false,
    }
  });

  adminPublicFlashcard1 = await prismaTestClient.flashcard.create({
    data: {
      front: "Admin Public Card 1 Front",
      back: "Admin Public Card 1 Back",
      deckId: adminPublicDeck.id,
      contentType: 'text',
    }
  });
  await prismaTestClient.userFlashcardStatus.create({
    data: {
      userId: adminUser.id,
      flashcardId: adminPublicFlashcard1.id,
      isDeleted: false,
    }
  });

  // Setup for getById Scenario 4: User B studying adminPublicFlashcard1
  await prismaTestClient.userFlashcardStatus.create({
    data: {
      userId: userB.id,
      flashcardId: adminPublicFlashcard1.id,
      isLearned: true,
      isDeleted: false,
    }
  });
});

afterEach(async () => {
  await prismaTestClient.userFlashcardStatus.deleteMany({});
  await prismaTestClient.flashcard.deleteMany({});
  await prismaTestClient.deck.deleteMany({});
  await prismaTestClient.user.deleteMany({});
});

afterAll(async () => {
  await _TEST_ONLY_disconnectAndResetPrismaClient();
  vi.restoreAllMocks();
});

describe('flashcardRouter tests', () => {
  it('should have seeded users and decks correctly for tests', () => {
    expect(userA).toBeDefined();
    expect(userA.email).toBe('usera@example.test');
    expect(userB).toBeDefined();
    expect(adminUser).toBeDefined();
    expect(adminUser.isAdmin).toBe(true);
    expect(userADeck).toBeDefined();
    expect(userADeck.userId).toBe(userA.id);
    expect(adminPublicDeck).toBeDefined();
    expect(adminPublicDeck.isPublic).toBe(true);
    expect(userAFlashcard1).toBeDefined();
    expect(adminPublicFlashcard1).toBeDefined();
  });
});

// We will add describe blocks for each procedure, starting with 'delete'
describe('flashcardRouter.delete Procedure', () => {
  it('Scenario 1: should ALLOW User A to delete their own flashcard and its status', async () => {
    const caller = await createCallerForTest(USER_A_TOKEN);

    // Pre-check: Ensure flashcard and its status exist
    let flashcardInDb = await prismaTestClient.flashcard.findUnique({ where: { id: userAFlashcard1.id } });
    expect(flashcardInDb).not.toBeNull();
    let statusInDb = await prismaTestClient.userFlashcardStatus.findUnique({
      where: { userId_flashcardId: { userId: userA.id, flashcardId: userAFlashcard1.id } },
    });
    expect(statusInDb).not.toBeNull();

    const result = await caller.flashcards.delete({ flashcardId: userAFlashcard1.id });

    expect(result.success).toBe(true);
    expect(result.message).toBe('Flashcard deleted successfully.');

    // Verify flashcard is deleted from DB
    flashcardInDb = await prismaTestClient.flashcard.findUnique({ where: { id: userAFlashcard1.id } });
    expect(flashcardInDb).toBeNull();

    // Verify UserFlashcardStatus is also deleted (due to cascade)
    statusInDb = await prismaTestClient.userFlashcardStatus.findUnique({
      where: { userId_flashcardId: { userId: userA.id, flashcardId: userAFlashcard1.id } },
    });
    expect(statusInDb).toBeNull();
  });

  it('Scenario 2: should ALLOW User B to soft-delete a public flashcard they are studying', async () => {
    const caller = await createCallerForTest(USER_B_TOKEN);

    // Setup: Ensure User B is studying the public flashcard and status is not deleted
    const userBStatus = await prismaTestClient.userFlashcardStatus.upsert({
      where: { userId_flashcardId: { userId: userB.id, flashcardId: adminPublicFlashcard1.id } },
      update: { isDeleted: false }, // Ensure it is not deleted for this test
      create: {
        userId: userB.id,
        flashcardId: adminPublicFlashcard1.id,
        isLearned: true, // Consistent with global beforeEach setup for User B
        isDeleted: false,
      },
    });
    expect(userBStatus.isDeleted).toBe(false);

    // Pre-check: Ensure flashcard exists
    const publicFlashcardInDb = await prismaTestClient.flashcard.findUnique({ where: { id: adminPublicFlashcard1.id } });
    expect(publicFlashcardInDb).not.toBeNull();

    const result = await caller.flashcards.delete({ flashcardId: adminPublicFlashcard1.id });

    expect(result.success).toBe(true);
    expect(result.message).toBe('Flashcard removed from your study list.');

    // Verify public flashcard still exists in DB
    const stillPublicFlashcardInDb = await prismaTestClient.flashcard.findUnique({ where: { id: adminPublicFlashcard1.id } });
    expect(stillPublicFlashcardInDb).not.toBeNull();

    // Verify User B's UserFlashcardStatus is soft-deleted
    const updatedUserBStatus = await prismaTestClient.userFlashcardStatus.findUnique({
      where: { id: userBStatus.id },
    });
    expect(updatedUserBStatus).not.toBeNull();
    expect(updatedUserBStatus?.isDeleted).toBe(true);

    // Verify Admin's status for the same card is unaffected (if it exists and is relevant to check)
    const adminStatus = await prismaTestClient.userFlashcardStatus.findFirst({
        where: { userId: adminUser.id, flashcardId: adminPublicFlashcard1.id }
    });
    expect(adminStatus).not.toBeNull();
    expect(adminStatus?.isDeleted).toBe(false); // Assuming admin's status was not deleted
  });

  it('Scenario 3: should handle User B trying to delete an already soft-deleted public flashcard', async () => {
    const caller = await createCallerForTest(USER_B_TOKEN);

    // Setup: User B has already soft-deleted their status for the public flashcard
    const userBStatus = await prismaTestClient.userFlashcardStatus.upsert({
      where: { userId_flashcardId: { userId: userB.id, flashcardId: adminPublicFlashcard1.id } },
      update: { isDeleted: true }, // Ensure it IS deleted for this test
      create: { // This path might not be hit if global beforeEach always creates it
        userId: userB.id,
        flashcardId: adminPublicFlashcard1.id,
        isLearned: true, // Consistent
        isDeleted: true,
      },
    });
    expect(userBStatus.isDeleted).toBe(true); // Verify setup

    const result = await caller.flashcards.delete({ flashcardId: adminPublicFlashcard1.id });

    expect(result.success).toBe(true);
    expect(result.message).toBe('Flashcard already removed from your study list.');

    // Verify public flashcard still exists
    const publicFlashcardInDb = await prismaTestClient.flashcard.findUnique({ where: { id: adminPublicFlashcard1.id } });
    expect(publicFlashcardInDb).not.toBeNull();

    // Verify User B's UserFlashcardStatus is still soft-deleted
    const stillUserBStatus = await prismaTestClient.userFlashcardStatus.findUnique({
      where: { id: userBStatus.id },
    });
    expect(stillUserBStatus).not.toBeNull();
    expect(stillUserBStatus?.isDeleted).toBe(true);
  });

  it('Scenario 4: should DENY User B from deleting a public flashcard they are not studying', async () => {
    const caller = await createCallerForTest(USER_B_TOKEN);

    // Ensure User B has no status for this public flashcard
    const existingStatus = await prismaTestClient.userFlashcardStatus.findUnique({
      where: { userId_flashcardId: { userId: userB.id, flashcardId: adminPublicFlashcard1.id } }
    });
    if (existingStatus) { // Clean up if a previous test/setup accidentally created one
      await prismaTestClient.userFlashcardStatus.delete({ where: { id: existingStatus.id } });
    }

    try {
      await caller.flashcards.delete({ flashcardId: adminPublicFlashcard1.id });
      expect.fail('Should have thrown TRPCError FORBIDDEN');
    } catch (error: any) {
      expect(error.name).toBe('TRPCError');
      expect(error.code).toBe('FORBIDDEN');
      expect(error.message).toBe('You are not studying this public flashcard and cannot remove it.');
    }

    // Verify public flashcard still exists
    const publicFlashcardInDb = await prismaTestClient.flashcard.findUnique({ where: { id: adminPublicFlashcard1.id } });
    expect(publicFlashcardInDb).not.toBeNull();
  });

  it("Scenario 5: should DENY User B from deleting User A's private flashcard", async () => {
    const caller = await createCallerForTest(USER_B_TOKEN);

    // Pre-check: User A's flashcard exists
    const userAFlashcardInDb = await prismaTestClient.flashcard.findUnique({ where: { id: userAFlashcard1.id } });
    expect(userAFlashcardInDb).not.toBeNull();

    try {
      await caller.flashcards.delete({ flashcardId: userAFlashcard1.id });
      expect.fail('Should have thrown TRPCError FORBIDDEN');
    } catch (error: any) {
      expect(error.name).toBe('TRPCError');
      expect(error.code).toBe('FORBIDDEN');
      expect(error.message).toBe('You do not have permission to delete this flashcard.');
    }

    // Verify User A's flashcard still exists
    const stillUserAFlashcardInDb = await prismaTestClient.flashcard.findUnique({ where: { id: userAFlashcard1.id } });
    expect(stillUserAFlashcardInDb).not.toBeNull();
  });

  it('Scenario 6: should throw NOT_FOUND when trying to delete a non-existent flashcard', async () => {
    const caller = await createCallerForTest(USER_A_TOKEN); // Any authenticated user
    const nonExistentFlashcardId = 'non-existent-flashcard-id';

    try {
      await caller.flashcards.delete({ flashcardId: nonExistentFlashcardId });
      expect.fail('Should have thrown TRPCError NOT_FOUND');
    } catch (error: any) {
      expect(error.name).toBe('TRPCError');
      expect(error.code).toBe('NOT_FOUND');
      // Message can be: `Flashcard not found.` (as in the router code)
      expect(error.message).toBe('Flashcard not found.');
    }
  });

  it('Scenario 7: should DENY unauthenticated user from deleting any flashcard', async () => {
    const caller = await createCallerForTest(null); // Unauthenticated call

    try {
      await caller.flashcards.delete({ flashcardId: userAFlashcard1.id }); // Try to delete any valid card ID
      expect.fail('Should have thrown TRPCError UNAUTHORIZED');
    } catch (error: any) {
      expect(error.name).toBe('TRPCError');
      expect(error.code).toBe('UNAUTHORIZED');
      // The exact message might vary based on the protectedProcedure implementation detail
      // For now, just checking the code is sufficient.
    }
  });
});

describe('flashcardRouter.getById Procedure', () => {
  it('Scenario 1: User A gets own card, sees card and their status', async () => {
    const caller = await createCallerForTest(USER_A_TOKEN);
    
    // --- Test Logging ---
    const supCtx = await mockAuthGetUser(USER_A_TOKEN);
    console.log('[TestLog] getById S1 - userA.id (expected in ctx):', userA.id);
    console.log('[TestLog] getById S1 - userAFlashcard1.id:', userAFlashcard1.id);
    console.log('[TestLog] getById S1 - mockAuthGetUser for USER_A_TOKEN returns supabase user id:', supCtx.data.user?.id);
    // --- End Test Logging ---

    const result = await caller.flashcards.getById({ id: userAFlashcard1.id });
    console.log('[TestLog] getById S1 - result.userStatus:', JSON.stringify(result.userStatus)); // Log what router returns

    expect(result.id).toBe(userAFlashcard1.id);
    expect(result.userStatus).toBeDefined();
    expect(result.userStatus?.userId).toBe(userA.id);
  });

  it('Scenario 2: User A gets public card (not studying), sees card, no status', async () => {
    const caller = await createCallerForTest(USER_A_TOKEN);
    // Ensure User A is not studying adminPublicFlashcard1 for this test part
    await prismaTestClient.userFlashcardStatus.deleteMany({ where: { userId: userA.id, flashcardId: adminPublicFlashcard1.id }});
    const result = await caller.flashcards.getById({ id: adminPublicFlashcard1.id });
    expect(result.id).toBe(adminPublicFlashcard1.id);
    expect(result.userStatus).toBeUndefined();
  });

  it('Scenario 3: User A gets public card (studying), sees card and status', async () => {
    const caller = await createCallerForTest(USER_A_TOKEN);
    // Ensure User A IS studying adminPublicFlashcard1
    await prismaTestClient.userFlashcardStatus.upsert({
      where: { userId_flashcardId: { userId: userA.id, flashcardId: adminPublicFlashcard1.id } },
      update: { isBookmarked: true, isDeleted: false },
      create: { userId: userA.id, flashcardId: adminPublicFlashcard1.id, isBookmarked: true },
    });
    const result = await caller.flashcards.getById({ id: adminPublicFlashcard1.id });
    expect(result.id).toBe(adminPublicFlashcard1.id);
    expect(result.userStatus).toBeDefined();
    expect(result.userStatus?.userId).toBe(userA.id);
    expect(result.userStatus?.isBookmarked).toBe(true);
  });

  it('Scenario 4: User B gets public card (studying), sees card and status', async () => {
    // User B is set up to study adminPublicFlashcard1 in the outer beforeEach
    const caller = await createCallerForTest(USER_B_TOKEN);
    const result = await caller.flashcards.getById({ id: adminPublicFlashcard1.id });
    expect(result.id).toBe(adminPublicFlashcard1.id);
    expect(result.userStatus).toBeDefined();
    expect(result.userStatus?.userId).toBe(userB.id);
    expect(result.userStatus?.isLearned).toBe(true); // From initial seed
  });

  it('Scenario 5: Unauthenticated gets public card, sees card, no status', async () => {
    const caller = await createCallerForTest(null);
    const result = await caller.flashcards.getById({ id: adminPublicFlashcard1.id });
    expect(result.id).toBe(adminPublicFlashcard1.id);
    expect(result.userStatus).toBeUndefined();
  });

  it("Scenario 6: Unauthenticated gets User A's private card, sees card, no status", async () => {
    const caller = await createCallerForTest(null);
    const result = await caller.flashcards.getById({ id: userAFlashcard1.id });
    expect(result.id).toBe(userAFlashcard1.id);
    expect(result.userStatus).toBeUndefined();
  });

  it('Scenario 7: Attempt to get non-existent card throws NOT_FOUND', async () => {
    const caller = await createCallerForTest(USER_A_TOKEN);
    try {
      await caller.flashcards.getById({ id: 'non-existent-card-for-getbyid' });
      expect.fail('Should have thrown TRPCError NOT_FOUND');
    } catch (error: any) {
      expect(error.name).toBe('TRPCError');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toContain('Flashcard with ID non-existent-card-for-getbyid not found');
    }
  });

  it('Scenario 8: User A gets card with soft-deleted status, sees card, no status', async () => {
    const caller = await createCallerForTest(USER_A_TOKEN);
    // Soft-delete User A's status for userAFlashcard1
    const statusToUpdate = await prismaTestClient.userFlashcardStatus.findFirstOrThrow({
        where: { userId: userA.id, flashcardId: userAFlashcard1.id }
    });
    await prismaTestClient.userFlashcardStatus.update({
      where: { id: statusToUpdate.id },
      data: { isDeleted: true },
    });

    const result = await caller.flashcards.getById({ id: userAFlashcard1.id });
    expect(result.id).toBe(userAFlashcard1.id);
    expect(result.userStatus).toBeUndefined();
  });
});

describe('flashcardRouter.updateUserStatus Procedure', () => {
  it('Scenario 1: User A updates status for their own card', async () => {
    const caller = await createCallerForTest(USER_A_TOKEN);
    const updates = {
      flashcardId: userAFlashcard1.id,
      isBookmarked: true,
      interval: 5,
    };
    const updatedStatus = await caller.flashcards.updateUserStatus(updates);
    expect(updatedStatus.isBookmarked).toBe(true);
    expect(updatedStatus.interval).toBe(5);
    expect(updatedStatus.userId).toBe(userA.id);
    expect(updatedStatus.flashcardId).toBe(userAFlashcard1.id);

    const dbStatus = await prismaTestClient.userFlashcardStatus.findFirstOrThrow(
      { where: { userId: userA.id, flashcardId: userAFlashcard1.id } }
    );
    expect(dbStatus.isBookmarked).toBe(true);
    expect(dbStatus.interval).toBe(5);
  });

  it('Scenario 2: User A attempts to update status for a card not being studied (no status record)', async () => {
    const caller = await createCallerForTest(USER_A_TOKEN);
    // Ensure User A has no status for adminPublicFlashcard1 for this test
    await prismaTestClient.userFlashcardStatus.deleteMany({ where: { userId: userA.id, flashcardId: adminPublicFlashcard1.id }});
    
    const updates = { flashcardId: adminPublicFlashcard1.id, isLearned: true };
    try {
      await caller.flashcards.updateUserStatus(updates);
      expect.fail('Should have thrown TRPCError NOT_FOUND');
    } catch (error: any) {
      expect(error.name).toBe('TRPCError');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toContain(`Status for flashcard ID ${adminPublicFlashcard1.id} not found`);
    }
  });

  it('Scenario 3: User A attempts to update status for a non-existent flashcard', async () => {
    const caller = await createCallerForTest(USER_A_TOKEN);
    const updates = { flashcardId: 'non-existent-fc-for-status', interval: 10 };
    try {
      await caller.flashcards.updateUserStatus(updates);
      expect.fail('Should have thrown TRPCError NOT_FOUND');
    } catch (error: any) {
      expect(error.name).toBe('TRPCError');
      expect(error.code).toBe('NOT_FOUND');
      // The error message here will be about the status not found, as it queries UserFlashcardStatus first.
      expect(error.message).toContain(`Status for flashcard ID non-existent-fc-for-status not found`);
    }
  });

  it('Scenario 4: Unauthenticated user attempts to update status', async () => {
    const caller = await createCallerForTest(null);
    const updates = { flashcardId: userAFlashcard1.id, isBookmarked: true };
    try {
      await caller.flashcards.updateUserStatus(updates);
      expect.fail('Should have thrown TRPCError UNAUTHORIZED');
    } catch (error: any) {
      expect(error.name).toBe('TRPCError');
      expect(error.code).toBe('UNAUTHORIZED');
    }
  });

  it('Scenario 5: User A sends empty update (no fields to change), expects BAD_REQUEST', async () => {
    const caller = await createCallerForTest(USER_A_TOKEN);
    const updates = { flashcardId: userAFlashcard1.id }; // No actual update fields
    try {
      await caller.flashcards.updateUserStatus(updates as any); // Cast as any to bypass Zod client-side if strict
      expect.fail('Should have thrown TRPCError BAD_REQUEST');
    } catch (error: any) {
      expect(error.name).toBe('TRPCError');
      expect(error.code).toBe('BAD_REQUEST');
      expect(error.message).toBe('No update data provided.');
    }
  });

  it('Scenario 6: User A updates multiple fields (isLearned, repetitions, dueDate, lastReviewed)', async () => {
    const caller = await createCallerForTest(USER_A_TOKEN);
    const newDueDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // Tomorrow
    const newLastReviewed = new Date();

    const updates = {
      flashcardId: userAFlashcard1.id,
      isLearned: true,
      repetitions: 3,
      dueDate: newDueDate,
      lastReviewed: newLastReviewed,
    };
    const updatedStatus = await caller.flashcards.updateUserStatus(updates);
    expect(updatedStatus.isLearned).toBe(true);
    expect(updatedStatus.repetitions).toBe(3);
    expect(updatedStatus.dueDate?.toISOString()).toBe(newDueDate.toISOString());
    expect(updatedStatus.lastReviewed?.toISOString()).toBe(newLastReviewed.toISOString());

    const dbStatus = await prismaTestClient.userFlashcardStatus.findFirstOrThrow(
      { where: { userId: userA.id, flashcardId: userAFlashcard1.id } }
    );
    expect(dbStatus.isLearned).toBe(true);
    expect(dbStatus.repetitions).toBe(3);
  });
});

describe('flashcardRouter.getDueFlashcardsForUser Procedure', () => {
  let cardDueToday: Flashcard;
  let cardDueYesterday: Flashcard;
  let cardDueTomorrow: Flashcard;
  let cardNotDueNoDate: Flashcard;
  let cardDueButDeletedStatus: Flashcard;
  let dueTestDeck: Deck; // New deck for this test suite

  beforeEach(async () => {
    // Ensure User A has no other due cards by cleaning up their statuses first
    await prismaTestClient.userFlashcardStatus.deleteMany({ where: { userId: userA.id } });

    dueTestDeck = await prismaTestClient.deck.create({
      data: {
        name: "User A Due Cards Test Deck",
        userId: userA.id,
        isPublic: false,
      }
    });

    const today = new Date();
    const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
    const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);

    // Create cards in the new dueTestDeck
    cardDueToday = await prismaTestClient.flashcard.create({ data: { deckId: dueTestDeck.id, front: 'Due Today', back: 'B', contentType:'text' } });
    cardDueYesterday = await prismaTestClient.flashcard.create({ data: { deckId: dueTestDeck.id, front: 'Due Yesterday', back: 'B', contentType:'text' } });
    cardDueTomorrow = await prismaTestClient.flashcard.create({ data: { deckId: dueTestDeck.id, front: 'Due Tomorrow', back: 'B', contentType:'text' } });
    cardNotDueNoDate = await prismaTestClient.flashcard.create({ data: { deckId: dueTestDeck.id, front: 'Not Due No Date', back: 'B', contentType:'text' } });
    cardDueButDeletedStatus = await prismaTestClient.flashcard.create({ data: { deckId: dueTestDeck.id, front: 'Due Deleted', back: 'B', contentType:'text' } });

    // Create statuses for User A
    await prismaTestClient.userFlashcardStatus.createMany({
      data: [
        { userId: userA.id, flashcardId: cardDueToday.id, dueDate: today },
        { userId: userA.id, flashcardId: cardDueYesterday.id, dueDate: yesterday },
        { userId: userA.id, flashcardId: cardDueTomorrow.id, dueDate: tomorrow },
        { userId: userA.id, flashcardId: cardNotDueNoDate.id, dueDate: undefined },
        { userId: userA.id, flashcardId: cardDueButDeletedStatus.id, dueDate: yesterday, isDeleted: true },
      ]
    });
  });

  afterEach(async () => {
    // Clean up the dedicated deck and its cards
    await prismaTestClient.userFlashcardStatus.deleteMany({ where: { flashcard: { deckId: dueTestDeck.id } } });
    await prismaTestClient.flashcard.deleteMany({ where: { deckId: dueTestDeck.id } });
    await prismaTestClient.deck.deleteMany({ where: { id: dueTestDeck.id } });
  });

  it('Scenario 1 & 3: User A gets only cards due today or in the past', async () => {
    const caller = await createCallerForTest(USER_A_TOKEN);
    const result = await caller.flashcards.getDueFlashcardsForUser();
    
    expect(result.length).toBe(2);
    const ids = result.map(fc => fc.flashcard.id);
    expect(ids).toContain(cardDueToday.id);
    expect(ids).toContain(cardDueYesterday.id);
    expect(ids).not.toContain(cardDueTomorrow.id);
    expect(ids).not.toContain(cardNotDueNoDate.id); // Should not be due
  });

  it('Scenario 2: User A with no cards due gets an empty list', async () => {
    const caller = await createCallerForTest(USER_A_TOKEN);
    // Make all existing cards for User A IN THIS TEST SUITE's DECK not due
    await prismaTestClient.userFlashcardStatus.updateMany({
      where: { 
        userId: userA.id,
        flashcard: { deckId: dueTestDeck.id } // Scope to dueTestDeck
      },
      data: { dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000) }, 
    });
    const result = await caller.flashcards.getDueFlashcardsForUser();
    expect(result.length).toBe(0);
  });

  it('Scenario 4: Does not return cards with soft-deleted statuses, even if due', async () => {
    const caller = await createCallerForTest(USER_A_TOKEN);
    const result = await caller.flashcards.getDueFlashcardsForUser();
    const ids = result.map(fc => fc.flashcard.id);
    expect(ids).not.toContain(cardDueButDeletedStatus.id);
  });

  it('Scenario 5: Unauthenticated user attempt throws UNAUTHORIZED', async () => {
    const caller = await createCallerForTest(null);
    try {
      await caller.flashcards.getDueFlashcardsForUser();
      expect.fail('Should have thrown TRPCError UNAUTHORIZED');
    } catch (error: any) {
      expect(error.name).toBe('TRPCError');
      expect(error.code).toBe('UNAUTHORIZED');
    }
  });
});

describe('flashcardRouter.updateContent Procedure', () => {
  it('Scenario 1: User A updates own private card - content updates directly', async () => {
    const caller = await createCallerForTest(USER_A_TOKEN);
    const updates = {
      flashcardId: userAFlashcard1.id,
      front: 'Updated Private Front',
      back: 'Updated Private Back',
    };
    const updatedCard = await caller.flashcards.updateContent(updates);

    expect(updatedCard.id).toBe(userAFlashcard1.id);
    expect(updatedCard.front).toBe(updates.front);
    expect(updatedCard.deckId).toBe(userADeck.id);

    const dbCard = await prismaTestClient.flashcard.findUniqueOrThrow({ where: { id: userAFlashcard1.id } });
    expect(dbCard.front).toBe(updates.front);
    const status = await prismaTestClient.userFlashcardStatus.findFirstOrThrow(
        { where: { userId: userA.id, flashcardId: userAFlashcard1.id}}
    );
    expect(status.isDeleted).toBe(false);
  });

  it('Scenario 2: User A updates public card (not studying) - creates copy in new personal deck', async () => {
    const caller = await createCallerForTest(USER_A_TOKEN);
    await prismaTestClient.userFlashcardStatus.deleteMany({ where: { userId: userA.id, flashcardId: adminPublicFlashcard1.id }});

    const updates = { flashcardId: adminPublicFlashcard1.id, front: 'User A Copy Front' };
    const copiedCard = await caller.flashcards.updateContent(updates);

    expect(copiedCard.id).not.toBe(adminPublicFlashcard1.id);
    expect(copiedCard.front).toBe(updates.front);

    const newDeck = await prismaTestClient.deck.findUniqueOrThrow({ where: { id: copiedCard.deckId } });
    expect(newDeck.name).toBe(`Personal Copy of ${adminPublicDeck.name}`);
    expect(newDeck.isPublic).toBe(false);
    expect(newDeck.userId).toBe(userA.id);

    const originalPublicCard = await prismaTestClient.flashcard.findUniqueOrThrow({ where: { id: adminPublicFlashcard1.id } });
    expect(originalPublicCard.front).not.toBe(updates.front);

    const newStatus = await prismaTestClient.userFlashcardStatus.findFirstOrThrow(
        { where: { userId: userA.id, flashcardId: copiedCard.id }}
    );
    expect(newStatus.isDeleted).toBe(false);
  });

  it('Scenario 3: User A updates public card (studying) - copy, new deck, old status soft-deleted', async () => {
    const caller = await createCallerForTest(USER_A_TOKEN);
    const originalStatus = await prismaTestClient.userFlashcardStatus.upsert({
      where: { userId_flashcardId: { userId: userA.id, flashcardId: adminPublicFlashcard1.id } },
      update: { isDeleted: false }, create: { userId: userA.id, flashcardId: adminPublicFlashcard1.id },
    });

    const updates = { flashcardId: adminPublicFlashcard1.id, back: 'User A Copy Back from Studying' };
    const copiedCard = await caller.flashcards.updateContent(updates);

    expect(copiedCard.id).not.toBe(adminPublicFlashcard1.id);
    expect(copiedCard.back).toBe(updates.back);
    const newDeck = await prismaTestClient.deck.findUniqueOrThrow({ where: { id: copiedCard.deckId }, include: {user: true} });
    expect(newDeck.userId).toBe(userA.id);
    expect(newDeck.user?.id).toBe(userA.id);

    const updatedOriginalStatus = await prismaTestClient.userFlashcardStatus.findUniqueOrThrow({ where: { id: originalStatus.id }});
    expect(updatedOriginalStatus.isDeleted).toBe(true);

    const newStatus = await prismaTestClient.userFlashcardStatus.findFirstOrThrow({ where: { userId: userA.id, flashcardId: copiedCard.id }});
    expect(newStatus.isDeleted).toBe(false);
  });

  it('Scenario 4: Attempt to update non-existent flashcard throws NOT_FOUND', async () => {
    const caller = await createCallerForTest(USER_A_TOKEN);
    try {
      await caller.flashcards.updateContent({ flashcardId: 'non-existent-for-update', front: 'F' });
      expect.fail('Should have thrown NOT_FOUND');
    } catch (error: any) {
      expect(error.name).toBe('TRPCError');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.message).toContain('Flashcard not found');
    }
  });

  it('Scenario 5: Unauthenticated user attempts updateContent, throws UNAUTHORIZED', async () => {
    const caller = await createCallerForTest(null);
    try {
      await caller.flashcards.updateContent({ flashcardId: userAFlashcard1.id, front: 'F' });
      expect.fail('Should have thrown UNAUTHORIZED');
    } catch (error: any) {
      expect(error.name).toBe('TRPCError');
      expect(error.code).toBe('UNAUTHORIZED');
    }
  });

  describe('Scenario 6 & 7: Updating with targetDeckId', () => {
    let userAPersonalDeck2: Deck;
    beforeEach(async () => {
      userAPersonalDeck2 = await prismaTestClient.deck.create({
        data: { name: "User A Personal Deck 2", userId: userA.id, isPublic: false }
      });
    });

    it('6a: Updates private card, targetDeckId ignored (still in original deck)', async () => {
        const caller = await createCallerForTest(USER_A_TOKEN);
        const updates = {
            flashcardId: userAFlashcard1.id,
            front: 'Private Update with Target Deck',
            targetDeckId: userAPersonalDeck2.id,
        };
        const updatedCard = await caller.flashcards.updateContent(updates);
        expect(updatedCard.id).toBe(userAFlashcard1.id);
        expect(updatedCard.front).toBe(updates.front);
        expect(updatedCard.deckId).toBe(userADeck.id);
    });

    it('6b: Updates public card, copy created in specified targetDeckId (owned by user)', async () => {
        const caller = await createCallerForTest(USER_A_TOKEN);
        const updates = {
            flashcardId: adminPublicFlashcard1.id,
            front: 'Public Copy to Specific Deck',
            targetDeckId: userAPersonalDeck2.id,
        };
        const copiedCard = await caller.flashcards.updateContent(updates);
        expect(copiedCard.id).not.toBe(adminPublicFlashcard1.id);
        expect(copiedCard.front).toBe(updates.front);
        expect(copiedCard.deckId).toBe(userAPersonalDeck2.id);

        const newStatus = await prismaTestClient.userFlashcardStatus.findFirstOrThrow(
            { where: { userId: userA.id, flashcardId: copiedCard.id }}
        );
        expect(newStatus.isDeleted).toBe(false);
    });

    it('Scenario 7: Update public card, targetDeckId is unowned - throws FORBIDDEN', async () => {
        const caller = await createCallerForTest(USER_A_TOKEN);
        const userBDeck = await prismaTestClient.deck.create({data: {name: "User B Deck", userId: userB.id, isPublic: false}});
        
        const updates = {
            flashcardId: adminPublicFlashcard1.id,
            front: 'Trying to copy to User B deck',
            targetDeckId: userBDeck.id,
        };
        try {
            await caller.flashcards.updateContent(updates);
            expect.fail('Should have thrown FORBIDDEN error');
        } catch (error: any) {
            expect(error.name).toBe('TRPCError');
            expect(error.code).toBe('FORBIDDEN');
            expect(error.message).toBe('Target deck not found or not owned by user.');
        }
    });
  });
});