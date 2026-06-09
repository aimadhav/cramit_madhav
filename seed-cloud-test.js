const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function seedCloud() {
  console.log('🚀 Seeding real deck into Supabase...');

  const deckId = 'cloud-deck-physics-adv';
  const ownerId = '44418ac9-c868-41f7-9660-641341238475'; // Arjun
  
  // 1. Create Deck
  const { data: deck, error: deckError } = await supabase.from('decks').upsert({
    id: deckId,
    name: 'Advanced Physics (Cloud)',
    description: 'Real deck fetched from Supabase to test Sync Engine.',
    subject: 'Physics',
    is_public: true,
    version: 1,
    user_id: ownerId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }).select().single();

  if (deckError) throw deckError;

  // 2. Create Flashcards
  const flashcards = [
    {
      id: 'fc-cloud-1',
      deck_id: deckId,
      front: 'What is Heisenberg\'s Uncertainty Principle?',
      back: 'The uncertainty in position and momentum are inversely proportional.',
      front_content: JSON.stringify([{ type: 'text', value: 'What is Heisenberg\'s Uncertainty Principle?' }]),
      back_content: JSON.stringify([{ type: 'latex', value: '\\Delta x \\Delta p \\geq \\frac{\\hbar}{2}' }]),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'fc-cloud-2',
      deck_id: deckId,
      front: 'What is the speed of sound in dry air at 20°C?',
      back: '343 m/s',
      front_content: JSON.stringify([{ type: 'text', value: 'What is the speed of sound in dry air at 20°C?' }]),
      back_content: JSON.stringify([{ type: 'text', value: '343 m/s' }]),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  const { error: fcError } = await supabase.from('flashcards').upsert(flashcards);
  if (fcError) throw fcError;

  console.log('✅ Cloud deck and cards seeded successfully!');
}

seedCloud().catch(console.error);
