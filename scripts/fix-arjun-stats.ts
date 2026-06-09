import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function fixArjunStats() {
  console.log('🧪 Believablizing Arjun\'s data...');

  try {
    const arjun = await prisma.user.findUnique({
      where: { email: 'arjun@test.com' }
    });

    if (!arjun) {
      console.error('❌ Arjun not found! Run populate-presentation.ts first.');
      return;
    }

    // 1. Fix Daily Progress in UI (Total cards used as "Today" count in current UI logic)
    // Let's set it to 38 so it shows 38/50. 
    // All-time stats can be shown elsewhere or we can add a field later.
    await prisma.user.update({
      where: { id: arjun.id },
      data: {
        totalCardsStudied: 38, 
        totalTimeStudied: 125, // 125 minutes total
        streakDays: 15,
      }
    });

    // 2. Populate SRS progress for Physics Deck (deck-1)
    const physicsCards = await prisma.flashcard.findMany({
      where: { deckId: 'deck-1' }
    });

    console.log(`📚 Found ${physicsCards.length} Physics cards. Generating SRS history...`);

    for (let i = 0; i < physicsCards.length; i++) {
      const card = physicsCards[i];
      
      // Make some cards "Mastered" (interval > 21)
      // Some "Learning" (interval 1-7)
      // Some "Struggling" (interval 0)
      
      let interval = 0;
      let repetitions = 0;
      let stability = 0;
      let difficulty = 5;
      let dueDateOffset = 0;

      if (i < 5) {
        // Top 5 cards: Mastered (due in 25 days)
        interval = 25 + Math.floor(Math.random() * 10);
        repetitions = 8 + Math.floor(Math.random() * 5);
        stability = 30.5;
        difficulty = 2.1;
        dueDateOffset = interval;
      } else if (i < 10) {
        // Next 5 cards: Learning (DUE NOW - set to yesterday)
        interval = 3 + Math.floor(Math.random() * 5);
        repetitions = 3 + Math.floor(Math.random() * 2);
        stability = 5.2;
        difficulty = 4.5;
        dueDateOffset = -1; // 1 day ago
      } else {
        // Last 5 cards: New (DUE NOW - set to now)
        interval = 1;
        repetitions = 1;
        stability = 0.8;
        difficulty = 6.2;
        dueDateOffset = -0.1; // roughly 2 hours ago
      }

      await prisma.userFlashcardStatus.upsert({
        where: {
          userId_flashcardId: {
            userId: arjun.id,
            flashcardId: card.id
          }
        },
        update: {
          interval,
          repetitions,
          stability,
          difficulty,
          dueDate: new Date(Date.now() + dueDateOffset * 24 * 60 * 60 * 1000),
          lastReviewed: new Date(Date.now() - 24 * 60 * 60 * 1000),
          isBookmarked: i % 7 === 0,
          notes: i === 0 ? "Important: Remember the inertia of direction!" : ""
        },
        create: {
          userId: arjun.id,
          flashcardId: card.id,
          interval,
          repetitions,
          stability,
          difficulty,
          dueDate: new Date(Date.now() + dueDateOffset * 24 * 60 * 60 * 1000),
          lastReviewed: new Date(Date.now() - 24 * 60 * 60 * 1000),
          isBookmarked: i % 7 === 0,
          notes: i === 0 ? "Important: Remember the inertia of direction!" : ""
        }
      });
    }

    console.log('✅ Arjun\'s stats and SRS progress updated!');
    console.log('   - Progress: 38/50');
    console.log('   - Physics Mastery: ~33% (5/15 cards > 21 days)');
    console.log('   - Note added to first card.');

  } catch (err) {
    console.error('❌ Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

fixArjunStats();
