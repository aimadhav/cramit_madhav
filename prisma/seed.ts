import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed...');

  // Create a test user
  const user = await prisma.user.create({
    data: {
      id: 'guest-user',
      email: 'test@example.com',
      name: 'Test User',
      phone: '+1234567890',
      isPremium: true,
      isAdmin: false,
      totalCardsStudied: 150,
      totalTimeStudied: 1200, // 20 hours
      streakDays: 7,
      lastStudyDate: new Date(),
    },
  });

  console.log('✅ Created user:', user.email);

  // Import data from JSON
  const fs = require('fs');
  const path = require('path');
  const defaultDecksPath = path.join(__dirname, '../assets/data/default-decks.json');
  const rawData = fs.readFileSync(defaultDecksPath, 'utf8');
  const { decks } = JSON.parse(rawData);

  for (const deckData of decks) {
    const { flashcards, tags, ...deckAttrs } = deckData;
    
    // Create Deck
    const deck = await prisma.deck.create({ 
      data: {
        ...deckAttrs,
        tagsJson: JSON.stringify(tags),
        userId: user.id
      } 
    });
    console.log('✅ Created deck:', deck.name);

    // Create Flashcards for this deck
    for (const cardData of flashcards) {
      const { tags: cardTags, ...cardAttrs } = cardData;
      
      const flashcard = await prisma.flashcard.create({ 
        data: {
          ...cardAttrs,
          tagsJson: JSON.stringify(cardTags || []),
          deckId: deck.id
        } 
      });
      console.log('  ✅ Created flashcard:', cardData.front.substring(0, 30) + '...');
      
      // Create user flashcard status for SRS
      await prisma.userFlashcardStatus.create({
        data: {
          userId: user.id,
          flashcardId: flashcard.id,
          interval: 1,
          repetitions: 0,
          dueDate: new Date(),
          isBookmarked: Math.random() > 0.8, // 20% chance of being bookmarked
        },
      });
    }
  }

  // Create some study sessions
  const studySessions = [
    {
      deckId: 'deck-1',
      userId: user.id,
      startTime: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
      endTime: new Date(Date.now() - 1.5 * 60 * 60 * 1000), // 1.5 hours ago
      cardsStudied: 15,
      cardsCorrect: 12,
    },
    {
      deckId: 'deck-2',
      userId: user.id,
      startTime: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
      endTime: new Date(Date.now() - 23.5 * 60 * 60 * 1000), // 23.5 hours ago
      cardsStudied: 20,
      cardsCorrect: 18,
    },
    {
      deckId: 'deck-3',
      userId: user.id,
      startTime: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
      endTime: new Date(Date.now() - 47 * 60 * 60 * 1000), // 47 hours ago
      cardsStudied: 8,
      cardsCorrect: 6,
    },
  ];

  for (const sessionData of studySessions) {
    const session = await prisma.studySession.create({ data: sessionData });
    console.log('✅ Created study session for deck:', sessionData.deckId);
  }

  console.log('🎉 Database seeded successfully from JSON!');

  console.log('🎉 Database seeded successfully!');
  
  const totalFlashcards = decks.reduce((acc: number, deck: any) => acc + deck.flashcards.length, 0);
  console.log(`Created:`);
  console.log(`- 1 user`);
  console.log(`- ${decks.length} decks`);
  console.log(`- ${totalFlashcards} flashcards`);
  console.log(`- ${totalFlashcards} user flashcard statuses`);
  console.log(`- ${studySessions.length} study sessions`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });