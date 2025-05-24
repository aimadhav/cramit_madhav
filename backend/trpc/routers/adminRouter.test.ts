// backend/trpc/routers/adminRouter.test.ts
import type { AppRouter } from '../app-router';
import { PrismaClient, type User as PrismaUserType } from '@prisma/client';
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { mockAuthGetUser, createCallerForTest } from '../../../tests/testUtils';
import { getPrismaClient, _TEST_ONLY_disconnectAndResetPrismaClient } from '../../prisma/client'; // Import the reset function

let prismaTestClient: PrismaClient;
let adminUser: PrismaUserType;
let nonAdminUser: PrismaUserType;

const ADMIN_USER_ID = 'admin-test-id-001';
const ADMIN_TOKEN = 'mock-admin-token';
const NON_ADMIN_USER_ID = 'user-test-id-001';
const NON_ADMIN_TOKEN = 'mock-non-admin-token';

beforeAll(async () => {
  await _TEST_ONLY_disconnectAndResetPrismaClient();
  prismaTestClient = getPrismaClient();
});

beforeEach(async () => {
  // Clear related tables first due to potential foreign key constraints
  // (Though adminRouter primarily deals with Users directly, decks/flashcards might be added in future tests)
  await prismaTestClient.userFlashcardStatus.deleteMany({}); // Added back
  await prismaTestClient.flashcard.deleteMany({}); // Added back
  await prismaTestClient.deck.deleteMany({}); // Added back
  await prismaTestClient.user.deleteMany({});

  adminUser = await prismaTestClient.user.create({
    data: {
      id: ADMIN_USER_ID,
      email: 'admin@example.test',
      name: 'Admin Test User',
      isAdmin: true,
    },
  });

  nonAdminUser = await prismaTestClient.user.create({
    data: {
      id: NON_ADMIN_USER_ID,
      email: 'user@example.test',
      name: 'Regular Test User',
      isAdmin: false,
    },
  });

  mockAuthGetUser.mockReset();
  // Restore the correct mockImplementation logic
  mockAuthGetUser.mockImplementation(async (token?: string) => {
    if (token === ADMIN_TOKEN) {
      return { data: { user: { id: ADMIN_USER_ID, email: 'admin@example.test' } as any }, error: null };
    }
    if (token === NON_ADMIN_TOKEN) {
      return { data: { user: { id: NON_ADMIN_USER_ID, email: 'user@example.test' } as any }, error: null };
    }
    return { data: { user: null }, error: null };
  });
});

afterAll(async () => {
  await _TEST_ONLY_disconnectAndResetPrismaClient();
});

describe('adminRouter - Initial Setup & Auth', () => {
  it('should have seeded admin and non-admin users correctly', () => {
    expect(adminUser?.email).toBe('admin@example.test');
    expect(nonAdminUser?.email).toBe('user@example.test');
  });

}); 

// New describe block for adminProcedure authorization tests
describe('adminRouter - adminProcedure Authorization', () => {
  it('should ALLOW admin user to access an admin-only procedure (pingAdmin)', async () => {
    const caller = await createCallerForTest(ADMIN_TOKEN); // Using the mock admin token
    const result = await caller.admin.pingAdmin();
    expect(result).toBe("pong from admin");
  });

  it('should DENY non-admin user from an admin-only procedure (pingAdmin) with FORBIDDEN error', async () => {
    const caller = await createCallerForTest(NON_ADMIN_TOKEN); // Using the mock non-admin token
    try {
      await caller.admin.pingAdmin();
      // If it reaches here, the test fails because it didn't throw
      expect(true).toBe(false); 
    } catch (error: any) {
      expect(error.name).toBe('TRPCError');
      expect(error.code).toBe('FORBIDDEN');
      // Optionally, check the message if it's consistent
      // expect(error.message).toBe('Access denied. Administrator privileges required.');
    }
  });

  it('should DENY unauthenticated user from an admin-only procedure (pingAdmin) with UNAUTHORIZED error', async () => {
    const caller = await createCallerForTest(null); // No token for unauthenticated
    try {
      await caller.admin.pingAdmin();
      // If it reaches here, the test fails because it didn't throw
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.name).toBe('TRPCError');
      expect(error.code).toBe('UNAUTHORIZED'); 
      // The exact message might come from protectedProcedure ('Not authenticated with Supabase.' or 'User profile not found...')
      // So we might not want to assert the exact message string here unless it's very stable.
    }
  });
}); 

describe('adminRouter - listUsers Procedure', () => {
  it('should ALLOW admin user to list users and return expected data', async () => {
    const caller = await createCallerForTest(ADMIN_TOKEN);
    const users = await caller.admin.listUsers();

    expect(Array.isArray(users)).toBe(true);
    // We expect at least our two seeded users to be present
    expect(users.length).toBeGreaterThanOrEqual(2);

    const foundAdmin = users.find(u => u.id === adminUser.id);
    const foundNonAdmin = users.find(u => u.id === nonAdminUser.id);

    expect(foundAdmin).toBeDefined();
    expect(foundAdmin?.email).toBe(adminUser.email);
    expect(foundAdmin?.isAdmin).toBe(true);
    expect(foundAdmin?.name).toBe(adminUser.name);

    expect(foundNonAdmin).toBeDefined();
    expect(foundNonAdmin?.email).toBe(nonAdminUser.email);
    expect(foundNonAdmin?.isAdmin).toBe(false);
    expect(foundNonAdmin?.name).toBe(nonAdminUser.name);

    // Check for specific fields returned by the select clause
    users.forEach(user => {
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('email');
      expect(user).toHaveProperty('name');
      expect(user).toHaveProperty('isAdmin');
      expect(user).toHaveProperty('createdAt');
      expect(user).toHaveProperty('updatedAt');
    });
  });

  it('should DENY non-admin user from listUsers with FORBIDDEN error', async () => {
    const caller = await createCallerForTest(NON_ADMIN_TOKEN);
    await expect(caller.admin.listUsers()).rejects.toThrowError(
      expect.objectContaining({
        name: 'TRPCError',
        code: 'FORBIDDEN',
      })
    );
  });

  it('should DENY unauthenticated user from listUsers with UNAUTHORIZED error', async () => {
    const caller = await createCallerForTest(null);
    await expect(caller.admin.listUsers()).rejects.toThrowError(
      expect.objectContaining({
        name: 'TRPCError',
        code: 'UNAUTHORIZED',
      })
    );
  });
}); 

describe('adminRouter - adminCreateDeck Procedure', () => {
  const deckInput = {
    name: 'Admin Test Deck',
    description: 'A deck created by an admin for testing.',
  };

  it('should ALLOW admin to create a private deck', async () => {
    const caller = await createCallerForTest(ADMIN_TOKEN);
    const newDeck = await caller.admin.adminCreateDeck({
      ...deckInput,
      isPublic: false,
    });

    expect(newDeck).toBeDefined();
    expect(newDeck.name).toBe(deckInput.name);
    expect(newDeck.description).toBe(deckInput.description);
    expect(newDeck.isPublic).toBe(false);
    expect(newDeck.userId).toBe(adminUser.id); // Check if associated with the admin

    // Verify in DB
    const dbDeck = await prismaTestClient.deck.findUnique({ where: { id: newDeck.id } });
    expect(dbDeck).toBeDefined();
    expect(dbDeck?.name).toBe(deckInput.name);
    expect(dbDeck?.isPublic).toBe(false);
    expect(dbDeck?.userId).toBe(adminUser.id);
  });

  it('should ALLOW admin to create a public deck', async () => {
    const caller = await createCallerForTest(ADMIN_TOKEN);
    const newDeck = await caller.admin.adminCreateDeck({
      ...deckInput,
      name: 'Admin Public Test Deck', // Ensure unique name if tests run in parallel or DB isn't fully cleaned
      isPublic: true,
    });

    expect(newDeck).toBeDefined();
    expect(newDeck.name).toBe('Admin Public Test Deck');
    expect(newDeck.isPublic).toBe(true);
    expect(newDeck.userId).toBe(adminUser.id);

    // Verify in DB
    const dbDeck = await prismaTestClient.deck.findUnique({ where: { id: newDeck.id } });
    expect(dbDeck).toBeDefined();
    expect(dbDeck?.isPublic).toBe(true);
    expect(dbDeck?.userId).toBe(adminUser.id);
  });

  it('should DENY non-admin user from adminCreateDeck with FORBIDDEN error', async () => {
    const caller = await createCallerForTest(NON_ADMIN_TOKEN);
    await expect(caller.admin.adminCreateDeck({ ...deckInput, isPublic: false })).rejects.toThrowError(
      expect.objectContaining({ name: 'TRPCError', code: 'FORBIDDEN' })
    );
  });

  it('should DENY unauthenticated user from adminCreateDeck with UNAUTHORIZED error', async () => {
    const caller = await createCallerForTest(null);
    await expect(caller.admin.adminCreateDeck({ ...deckInput, isPublic: false })).rejects.toThrowError(
      expect.objectContaining({ name: 'TRPCError', code: 'UNAUTHORIZED' })
    );
  });

  // Clean up decks created in this describe block after each test to avoid interference
  // This is important if deck names need to be unique or if counts are asserted elsewhere.
  afterEach(async () => {
    await prismaTestClient.deck.deleteMany({ where: { userId: adminUser.id } });
  });
}); 

describe('adminRouter - adminUpdateDeck Procedure', () => {
  let existingDeckId: string;
  const initialDeckData = {
    name: 'Initial Deck Name',
    description: 'Initial description.',
    isPublic: false,
  };

  beforeEach(async () => {
    const caller = await createCallerForTest(ADMIN_TOKEN);
    const deck = await caller.admin.adminCreateDeck(initialDeckData);
    existingDeckId = deck.id;
  });

  afterEach(async () => {
    await prismaTestClient.deck.deleteMany({ where: { userId: adminUser.id } });
  });

  it('should ALLOW admin to update a deck\'s name, description, and isPublic status', async () => {
    const caller = await createCallerForTest(ADMIN_TOKEN);
    const updates = {
      id: existingDeckId,
      name: 'Updated Deck Name',
      description: 'Updated description.',
      isPublic: true,
    };
    const updatedDeck = await caller.admin.adminUpdateDeck(updates);

    expect(updatedDeck).toBeDefined();
    expect(updatedDeck.name).toBe(updates.name);
    expect(updatedDeck.description).toBe(updates.description);
    expect(updatedDeck.isPublic).toBe(updates.isPublic);
    expect(updatedDeck.userId).toBe(adminUser.id);

    const dbDeck = await prismaTestClient.deck.findUnique({ where: { id: existingDeckId } });
    expect(dbDeck).toBeDefined();
    expect(dbDeck?.name).toBe(updates.name);
    expect(dbDeck?.description).toBe(updates.description);
    expect(dbDeck?.isPublic).toBe(updates.isPublic);
  });

  it('should throw an error when trying to update a non-existent deck', async () => {
    const caller = await createCallerForTest(ADMIN_TOKEN);
    const nonExistentId = 'non-existent-deck-id';
    await expect(caller.admin.adminUpdateDeck({ id: nonExistentId, name: 'Test' })).rejects.toThrowError();
  });

  it('should DENY non-admin user from adminUpdateDeck with FORBIDDEN error', async () => {
    const caller = await createCallerForTest(NON_ADMIN_TOKEN);
    await expect(caller.admin.adminUpdateDeck({ id: existingDeckId, name: 'Attempt by Non-Admin' })).rejects.toThrowError(
      expect.objectContaining({ name: 'TRPCError', code: 'FORBIDDEN' })
    );
  });

  it('should DENY unauthenticated user from adminUpdateDeck with UNAUTHORIZED error', async () => {
    const caller = await createCallerForTest(null);
    await expect(caller.admin.adminUpdateDeck({ id: existingDeckId, name: 'Attempt by Unauth' })).rejects.toThrowError(
      expect.objectContaining({ name: 'TRPCError', code: 'UNAUTHORIZED' })
    );
  });
}); 

describe('adminRouter - adminDeleteDeck Procedure', () => {
  let deckToDeleteId: string;

  beforeEach(async () => {
    // Create a deck as admin to be deleted in tests
    const caller = await createCallerForTest(ADMIN_TOKEN);
    const deck = await caller.admin.adminCreateDeck({
      name: 'Deck To Be Deleted',
      description: 'This deck will be deleted by an admin.',
      isPublic: false,
    });
    deckToDeleteId = deck.id;
  });

  afterEach(async () => {
    // Attempt to clean up any deck that might have been created by the admin user
    // if a test failed before deletion or if multiple decks were involved.
    // This will silently fail if the deck was already deleted, which is fine.
    await prismaTestClient.deck.deleteMany({ where: { userId: adminUser.id } });
  });

  it('should ALLOW admin to delete an existing deck', async () => {
    const caller = await createCallerForTest(ADMIN_TOKEN);
    const result = await caller.admin.adminDeleteDeck({ id: deckToDeleteId });

    expect(result.success).toBe(true);
    expect(result.deletedDeckId).toBe(deckToDeleteId);

    // Verify in DB that the deck is gone
    const dbDeck = await prismaTestClient.deck.findUnique({ where: { id: deckToDeleteId } });
    expect(dbDeck).toBeNull();
  });

  it('should throw an error when admin tries to delete a non-existent deck', async () => {
    const caller = await createCallerForTest(ADMIN_TOKEN);
    const nonExistentId = 'non-existent-deck-id-to-delete';
    // Prisma's delete throws P2025 if record to delete is not found.
    await expect(caller.admin.adminDeleteDeck({ id: nonExistentId })).rejects.toThrowError(); 
  });

  it('should DENY non-admin user from adminDeleteDeck with FORBIDDEN error', async () => {
    const caller = await createCallerForTest(NON_ADMIN_TOKEN);
    await expect(caller.admin.adminDeleteDeck({ id: deckToDeleteId })).rejects.toThrowError(
      expect.objectContaining({ name: 'TRPCError', code: 'FORBIDDEN' })
    );
    // Ensure the deck was not deleted by the failed attempt
    const dbDeck = await prismaTestClient.deck.findUnique({ where: { id: deckToDeleteId } });
    expect(dbDeck).not.toBeNull(); 
  });

  it('should DENY unauthenticated user from adminDeleteDeck with UNAUTHORIZED error', async () => {
    const caller = await createCallerForTest(null);
    await expect(caller.admin.adminDeleteDeck({ id: deckToDeleteId })).rejects.toThrowError(
      expect.objectContaining({ name: 'TRPCError', code: 'UNAUTHORIZED' })
    );
    // Ensure the deck was not deleted by the failed attempt
    const dbDeck = await prismaTestClient.deck.findUnique({ where: { id: deckToDeleteId } });
    expect(dbDeck).not.toBeNull();
  });
}); 

describe('adminRouter - adminListDecks Procedure', () => {
  // Seed a variety of decks before each test in this suite
  const deckData = [
    // Public decks by adminUser
    { name: 'Admin Public Deck 1', description: '...', isPublic: true, byAdmin: true, flashcardCount: 2 },
    { name: 'Admin Public Deck 2', description: '...', isPublic: true, byAdmin: true, flashcardCount: 0 },
    { name: 'Admin Public Deck 3', description: '...', isPublic: true, byAdmin: true, flashcardCount: 1 },
    // Private decks by adminUser
    { name: 'Admin Private Deck 1', description: '...', isPublic: false, byAdmin: true, flashcardCount: 3 },
    { name: 'Admin Private Deck 2', description: '...', isPublic: false, byAdmin: true, flashcardCount: 0 },
    // Optional: Decks by another user (nonAdminUser for this example, assuming admin can see all)
    // For these to be seen by adminListDecks without userId filter, they'd typically be public
    // or adminListDecks would need logic to show all regardless of creator if no userId filter.
    // Let's assume for now adminListDecks can see any deck if no specific userId filter is applied.
    { name: 'User Public Deck 1', description: '...', isPublic: true, byAdmin: false, flashcardCount: 1 }, 
  ];

  beforeEach(async () => {
    // Ensure users are created (they are by the global beforeEach)
    const createdDecks = [];
    for (const data of deckData) {
      const userId = data.byAdmin ? adminUser.id : nonAdminUser.id;
      const deck = await prismaTestClient.deck.create({
        data: {
          name: data.name,
          description: data.description,
          isPublic: data.isPublic,
          userId: userId,
          // Seed flashcards if we want to test _count accurately
          flashcards: data.flashcardCount > 0 ? {
            createMany: {
              data: Array(data.flashcardCount).fill(null).map((_, i) => ({
                front: `Front ${i+1} for ${data.name}`,
                back: `Back ${i+1} for ${data.name}`,
                contentType: 'text', // Added default contentType
              })),
            }
          } : undefined,
        },
      });
      createdDecks.push(deck);
    }
  });

  afterEach(async () => {
    // Clean up all decks and flashcards to prevent interference between tests
    await prismaTestClient.flashcard.deleteMany({});
    await prismaTestClient.deck.deleteMany({});
  });

  it('should ALLOW admin to list decks (basic retrieval)', async () => {
    const caller = await createCallerForTest(ADMIN_TOKEN);
    const result = await caller.admin.adminListDecks({}); // No input, should use default limit
    expect(result.decks.length).toBe(deckData.length);
    expect(result.nextCursor).toBeUndefined(); 
  });

  it('should handle pagination with limit and nextCursor', async () => {
    const caller = await createCallerForTest(ADMIN_TOKEN);
    const limit = 2;

    // First call
    const page1 = await caller.admin.adminListDecks({ limit });
    expect(page1.decks.length).toBe(limit);
    expect(page1.nextCursor).toBeDefined();
    const firstSetIds = page1.decks.map(d => d.id);

    // Second call
    const page2 = await caller.admin.adminListDecks({ limit, cursor: page1.nextCursor });
    expect(page2.decks.length).toBe(limit);
    expect(page2.nextCursor).toBeDefined();
    const secondSetIds = page2.decks.map(d => d.id);
    // Ensure no overlap with first set
    firstSetIds.forEach(id => expect(secondSetIds).not.toContain(id));

    // Third call (assuming deckData.length is 6, so 2 items left)
    const page3 = await caller.admin.adminListDecks({ limit, cursor: page2.nextCursor });
    expect(page3.decks.length).toBe(deckData.length - limit * 2); // Remaining decks
    expect(page3.nextCursor).toBeUndefined(); // Should be the last page
  });

  it('should filter by isPublic: true', async () => {
    const caller = await createCallerForTest(ADMIN_TOKEN);
    const result = await caller.admin.adminListDecks({ isPublic: true });
    const expectedPublicCount = deckData.filter(d => d.isPublic).length;
    expect(result.decks.length).toBe(expectedPublicCount);
    result.decks.forEach(deck => expect(deck.isPublic).toBe(true));
  });

  it('should filter by isPublic: false', async () => {
    const caller = await createCallerForTest(ADMIN_TOKEN);
    const result = await caller.admin.adminListDecks({ isPublic: false });
    const expectedPrivateCount = deckData.filter(d => !d.isPublic).length;
    expect(result.decks.length).toBe(expectedPrivateCount);
    result.decks.forEach(deck => expect(deck.isPublic).toBe(false));
  });

  it('should filter by userId (adminUser)', async () => {
    const caller = await createCallerForTest(ADMIN_TOKEN);
    const result = await caller.admin.adminListDecks({ userId: adminUser.id });
    const expectedAdminDecksCount = deckData.filter(d => d.byAdmin).length;
    expect(result.decks.length).toBe(expectedAdminDecksCount);
    result.decks.forEach(deck => expect(deck.userId).toBe(adminUser.id));
  });

  it('should filter by userId (nonAdminUser)', async () => {
    const caller = await createCallerForTest(ADMIN_TOKEN);
    const result = await caller.admin.adminListDecks({ userId: nonAdminUser.id });
    const expectedNonAdminDecksCount = deckData.filter(d => !d.byAdmin).length;
    expect(result.decks.length).toBe(expectedNonAdminDecksCount);
    result.decks.forEach(deck => expect(deck.userId).toBe(nonAdminUser.id));
  });

  it('should combine filters (userId and isPublic)', async () => {
    const caller = await createCallerForTest(ADMIN_TOKEN);
    const result = await caller.admin.adminListDecks({ userId: adminUser.id, isPublic: true });
    const expectedCount = deckData.filter(d => d.byAdmin && d.isPublic).length;
    expect(result.decks.length).toBe(expectedCount);
    result.decks.forEach(deck => {
      expect(deck.userId).toBe(adminUser.id);
      expect(deck.isPublic).toBe(true);
    });
  });

  it('should return correct flashcard counts', async () => {
    const caller = await createCallerForTest(ADMIN_TOKEN);
    const result = await caller.admin.adminListDecks({});
    expect(result.decks.length).toBe(deckData.length);

    for (const seededDeck of deckData) {
      const fetchedDeck = result.decks.find(d => d.name === seededDeck.name);
      expect(fetchedDeck).toBeDefined();
      expect(fetchedDeck?._count?.flashcards).toBe(seededDeck.flashcardCount);
    }
  });

  // Access control tests
  it('should DENY non-admin user from adminListDecks with FORBIDDEN error', async () => {
    const caller = await createCallerForTest(NON_ADMIN_TOKEN);
    await expect(caller.admin.adminListDecks({})).rejects.toThrowError(
      expect.objectContaining({ name: 'TRPCError', code: 'FORBIDDEN' })
    );
  });

  it('should DENY unauthenticated user from adminListDecks with UNAUTHORIZED error', async () => {
    const caller = await createCallerForTest(null);
    await expect(caller.admin.adminListDecks({})).rejects.toThrowError(
      expect.objectContaining({ name: 'TRPCError', code: 'UNAUTHORIZED' })
    );
  });

  // More tests for pagination, filtering, etc., will be added here.
}); 

describe('adminRouter - adminCreateFlashcard Procedure', () => {
  let testDeckId: string;
  const flashcardInput = {
    front: 'Admin Test Front',
    back: 'Admin Test Back',
    contentType: 'text/plain',
  };

  beforeEach(async () => {
    // Create a deck as admin to add flashcards to
    const caller = await createCallerForTest(ADMIN_TOKEN);
    const deck = await caller.admin.adminCreateDeck({
      name: 'Deck for Admin Flashcards',
      description: 'Temporary deck for testing adminCreateFlashcard',
      isPublic: false,
    });
    testDeckId = deck.id;
  });

  afterEach(async () => {
    // Clean up flashcards and the deck
    await prismaTestClient.flashcard.deleteMany({ where: { deckId: testDeckId } });
    await prismaTestClient.deck.delete({ where: { id: testDeckId } });
  });

  it('should ALLOW admin to create a flashcard in an existing deck', async () => {
    const caller = await createCallerForTest(ADMIN_TOKEN);
    const newFlashcard = await caller.admin.adminCreateFlashcard({
      ...flashcardInput,
      deckId: testDeckId,
    });

    expect(newFlashcard).toBeDefined();
    expect(newFlashcard.front).toBe(flashcardInput.front);
    expect(newFlashcard.back).toBe(flashcardInput.back);
    expect(newFlashcard.contentType).toBe(flashcardInput.contentType);
    expect(newFlashcard.deckId).toBe(testDeckId);

    // Verify in DB
    const dbFlashcard = await prismaTestClient.flashcard.findUnique({ where: { id: newFlashcard.id } });
    expect(dbFlashcard).toBeDefined();
    expect(dbFlashcard?.front).toBe(flashcardInput.front);
    expect(dbFlashcard?.deckId).toBe(testDeckId);
  });

  it('should DENY non-admin user from adminCreateFlashcard with FORBIDDEN error', async () => {
    const caller = await createCallerForTest(NON_ADMIN_TOKEN);
    await expect(caller.admin.adminCreateFlashcard({ ...flashcardInput, deckId: testDeckId })).rejects.toThrowError(
      expect.objectContaining({ name: 'TRPCError', code: 'FORBIDDEN' })
    );
  });

  it('should DENY unauthenticated user from adminCreateFlashcard with UNAUTHORIZED error', async () => {
    const caller = await createCallerForTest(null);
    await expect(caller.admin.adminCreateFlashcard({ ...flashcardInput, deckId: testDeckId })).rejects.toThrowError(
      expect.objectContaining({ name: 'TRPCError', code: 'UNAUTHORIZED' })
    );
  });

  // Optional: Test creating a flashcard with a non-existent deckId - depends on how robust the procedure is.
  // For now, the procedure assumes deckId is valid. Prisma would throw if deckId is invalid due to foreign key constraint.
  it('should throw an error if trying to create a flashcard with a non-existent deckId', async () => {
    const caller = await createCallerForTest(ADMIN_TOKEN);
    await expect(caller.admin.adminCreateFlashcard({ ...flashcardInput, deckId: 'non-existent-deck-id' })).rejects.toThrowError();
    // Prisma will likely throw a P2003 error (foreign key constraint failed)
  });
}); 

describe('adminRouter - adminUpdateFlashcard Procedure', () => {
  let sourceDeckId: string;
  let targetDeckId: string;
  let testFlashcardId: string;
  const initialFlashcardData = {
    front: 'Initial Front',
    back: 'Initial Back',
    contentType: 'text/initial',
  };

  beforeEach(async () => {
    const caller = await createCallerForTest(ADMIN_TOKEN);
    // Create source deck
    const sDeck = await caller.admin.adminCreateDeck({ name: 'Source Deck for Update Tests', isPublic: false });
    sourceDeckId = sDeck.id;
    // Create target deck
    const tDeck = await caller.admin.adminCreateDeck({ name: 'Target Deck for Update Tests', isPublic: false });
    targetDeckId = tDeck.id;
    // Create flashcard in source deck
    const flashcard = await caller.admin.adminCreateFlashcard({ ...initialFlashcardData, deckId: sourceDeckId });
    testFlashcardId = flashcard.id;
  });

  afterEach(async () => {
    // Clean up: flashcards are deleted by deck cascade if schema supports it, or delete explicitly
    // For safety, delete flashcards that might have been moved or orphaned if tests failed.
    await prismaTestClient.flashcard.deleteMany({ where: { OR: [{id: testFlashcardId}, {deckId: sourceDeckId}, {deckId: targetDeckId}] }});
    await prismaTestClient.deck.deleteMany({ where: { OR: [{id: sourceDeckId}, {id: targetDeckId}] }});
  });

  it('should ALLOW admin to update a flashcard\'s content (front, back, contentType)', async () => {
    const caller = await createCallerForTest(ADMIN_TOKEN);
    const updates = {
      id: testFlashcardId,
      front: 'Updated Front',
      back: 'Updated Back',
      contentType: 'text/updated',
    };
    const updatedFlashcard = await caller.admin.adminUpdateFlashcard(updates);

    expect(updatedFlashcard.front).toBe(updates.front);
    expect(updatedFlashcard.back).toBe(updates.back);
    expect(updatedFlashcard.contentType).toBe(updates.contentType);
    expect(updatedFlashcard.deckId).toBe(sourceDeckId); // Deck should not have changed

    const dbFlashcard = await prismaTestClient.flashcard.findUnique({ where: { id: testFlashcardId } });
    expect(dbFlashcard?.front).toBe(updates.front);
    expect(dbFlashcard?.contentType).toBe(updates.contentType);
  });

  it('should ALLOW admin to move a flashcard to another deck (update deckId)', async () => {
    const caller = await createCallerForTest(ADMIN_TOKEN);
    const updatedFlashcard = await caller.admin.adminUpdateFlashcard({
      id: testFlashcardId,
      deckId: targetDeckId,
    });

    expect(updatedFlashcard.deckId).toBe(targetDeckId);
    const dbFlashcard = await prismaTestClient.flashcard.findUnique({ where: { id: testFlashcardId } });
    expect(dbFlashcard?.deckId).toBe(targetDeckId);
  });

  it('should throw an error when admin tries to update a non-existent flashcard', async () => {
    const caller = await createCallerForTest(ADMIN_TOKEN);
    await expect(caller.admin.adminUpdateFlashcard({ id: 'non-existent-flashcard-id', front: 'Test' })).rejects.toThrowError();
  });

  it('should DENY non-admin user from adminUpdateFlashcard with FORBIDDEN error', async () => {
    const caller = await createCallerForTest(NON_ADMIN_TOKEN);
    await expect(caller.admin.adminUpdateFlashcard({ id: testFlashcardId, front: 'Attempt by Non-Admin' })).rejects.toThrowError(
      expect.objectContaining({ name: 'TRPCError', code: 'FORBIDDEN' })
    );
  });

  it('should DENY unauthenticated user from adminUpdateFlashcard with UNAUTHORIZED error', async () => {
    const caller = await createCallerForTest(null);
    await expect(caller.admin.adminUpdateFlashcard({ id: testFlashcardId, front: 'Attempt by Unauth' })).rejects.toThrowError(
      expect.objectContaining({ name: 'TRPCError', code: 'UNAUTHORIZED' })
    );
  });
}); 

describe('adminRouter - adminDeleteFlashcard Procedure', () => {
  let testDeckId: string;
  let flashcardToDeleteId: string;

  beforeEach(async () => {
    const caller = await createCallerForTest(ADMIN_TOKEN);
    const deck = await caller.admin.adminCreateDeck({ 
      name: 'Deck for Admin Delete Flashcard Tests', 
      isPublic: false 
    });
    testDeckId = deck.id;
    const flashcard = await caller.admin.adminCreateFlashcard({
      deckId: testDeckId,
      front: 'Card to delete - Front',
      back: 'Card to delete - Back',
      contentType: 'text',
    });
    flashcardToDeleteId = flashcard.id;
  });

  afterEach(async () => {
    // Clean up deck (flashcards associated might be auto-deleted by cascade, or need explicit delete if not)
    // Explicitly delete the flashcard if it wasn't deleted by the test, then the deck.
    await prismaTestClient.flashcard.deleteMany({ where: { id: flashcardToDeleteId }}); // Handles if test failed before delete
    await prismaTestClient.deck.deleteMany({ where: { id: testDeckId } }); // Changed to deleteMany for robustness
  });

  it('should ALLOW admin to delete an existing flashcard', async () => {
    const caller = await createCallerForTest(ADMIN_TOKEN);
    const result = await caller.admin.adminDeleteFlashcard({ id: flashcardToDeleteId });

    expect(result.success).toBe(true);
    expect(result.deletedFlashcardId).toBe(flashcardToDeleteId);

    const dbFlashcard = await prismaTestClient.flashcard.findUnique({ where: { id: flashcardToDeleteId } });
    expect(dbFlashcard).toBeNull();
  });

  it('should throw an error when admin tries to delete a non-existent flashcard', async () => {
    const caller = await createCallerForTest(ADMIN_TOKEN);
    await expect(caller.admin.adminDeleteFlashcard({ id: 'non-existent-fc-id' })).rejects.toThrowError();
  });

  it('should DENY non-admin user from adminDeleteFlashcard with FORBIDDEN error', async () => {
    const caller = await createCallerForTest(NON_ADMIN_TOKEN);
    await expect(caller.admin.adminDeleteFlashcard({ id: flashcardToDeleteId })).rejects.toThrowError(
      expect.objectContaining({ name: 'TRPCError', code: 'FORBIDDEN' })
    );
    // Verify flashcard still exists
    const dbFlashcard = await prismaTestClient.flashcard.findUnique({ where: { id: flashcardToDeleteId } });
    expect(dbFlashcard).not.toBeNull();
  });

  it('should DENY unauthenticated user from adminDeleteFlashcard with UNAUTHORIZED error', async () => {
    const caller = await createCallerForTest(null);
    await expect(caller.admin.adminDeleteFlashcard({ id: flashcardToDeleteId })).rejects.toThrowError(
      expect.objectContaining({ name: 'TRPCError', code: 'UNAUTHORIZED' })
    );
    // Verify flashcard still exists
    const dbFlashcard = await prismaTestClient.flashcard.findUnique({ where: { id: flashcardToDeleteId } });
    expect(dbFlashcard).not.toBeNull();
  });
}); 

// Example test suite (can be removed if you keep your existing ones)
describe('adminRouter - Auth Check with Revi.mock (Example)', () => {
  it('pingAdmin should work for admin', async () => {
    const caller = await createCallerForTest(ADMIN_TOKEN);
    const result = await caller.admin.pingAdmin();
    expect(result).toBe("pong from admin");
  });

  it('pingAdmin should be forbidden for non-admin', async () => {
    const caller = await createCallerForTest(NON_ADMIN_TOKEN);
    await expect(caller.admin.pingAdmin()).rejects.toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN' })
    );
  });

  it('pingAdmin should be unauthorized for null token', async () => {
    const caller = await createCallerForTest(null);
    await expect(caller.admin.pingAdmin()).rejects.toThrowError(
      expect.objectContaining({ code: 'UNAUTHORIZED' })
    );
  });
}); 