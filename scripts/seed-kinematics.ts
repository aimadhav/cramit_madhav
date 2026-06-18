import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase URL or Service Role Key in .env');
  process.exit(1);
}

// We use the Service Role Key to bypass Row Level Security (RLS) for the script
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const kinematicsCards = [
  {
    q: "What is the primary difference between **Distance** and **Displacement**?",
    a: "**Distance** is a scalar quantity (total path length).\n\n**Displacement** is a vector quantity (shortest straight-line distance from initial to final position).",
    qImg: "", aImg: "", stability: 2.5
  },
  {
    q: "State the first kinematic equation of motion (Velocity-Time relation).",
    a: "$$v = u + at$$",
    qImg: "", aImg: "", stability: 5.0
  },
  {
    q: "State the second kinematic equation of motion (Position-Time relation).",
    a: "$$s = ut + \\frac{1}{2}at^2$$",
    qImg: "", aImg: "", stability: 2.5
  },
  {
    q: "State the third kinematic equation of motion (Velocity-Position relation).",
    a: "$$v^2 = u^2 + 2as$$",
    qImg: "", aImg: "", stability: 2.5
  },
  {
    q: "What is the formula for displacement covered in the **nth** second of uniformly accelerated motion?",
    a: "$$S_n = u + \\frac{a}{2}(2n - 1)$$",
    qImg: "", aImg: "", stability: 1.0
  },
  {
    q: "What physical quantity does the **slope** of a Position-Time ($x-t$) graph represent?",
    a: "**Velocity**\n$$v = \\frac{dx}{dt}$$",
    qImg: "https://placehold.co/600x400/15171b/ececec?text=Position-Time+Graph", aImg: "", stability: 2.5
  },
  {
    q: "What physical quantity does the **slope** of a Velocity-Time ($v-t$) graph represent?",
    a: "**Acceleration**\n$$a = \\frac{dv}{dt}$$",
    qImg: "https://placehold.co/600x400/15171b/ececec?text=Velocity-Time+Graph", aImg: "", stability: 2.5
  },
  {
    q: "What does the **area under the curve** of a Velocity-Time ($v-t$) graph represent?",
    a: "**Displacement**\n$$\\Delta x = \\int v \\, dt$$",
    qImg: "", aImg: "", stability: 2.5
  },
  {
    q: "What does the **area under the curve** of an Acceleration-Time ($a-t$) graph represent?",
    a: "**Change in Velocity** ($\\Delta v$)\n$$\\Delta v = \\int a \\, dt$$",
    qImg: "", aImg: "", stability: 1.0
  },
  {
    q: "For an object thrown vertically upwards with initial velocity $u$, what is the **time taken to reach maximum height**?",
    a: "$$t = \\frac{u}{g}$$",
    qImg: "", aImg: "", stability: 2.5
  },
  {
    q: "For an object thrown vertically upwards with initial velocity $u$, what is the **maximum height** reached?",
    a: "$$H = \\frac{u^2}{2g}$$",
    qImg: "", aImg: "", stability: 2.5
  },
  {
    q: "What is the formula for the **Time of Flight** ($T$) of a projectile?",
    a: "$$T = \\frac{2u \\sin\\theta}{g}$$",
    qImg: "https://placehold.co/600x400/15171b/ececec?text=Projectile+Motion", aImg: "", stability: 1.0
  },
  {
    q: "What is the formula for the **Maximum Height** ($H$) of a projectile?",
    a: "$$H = \\frac{u^2 \\sin^2\\theta}{2g}$$",
    qImg: "", aImg: "", stability: 1.0
  },
  {
    q: "What is the formula for the **Horizontal Range** ($R$) of a projectile?",
    a: "$$R = \\frac{u^2 \\sin 2\\theta}{g}$$",
    qImg: "", aImg: "", stability: 1.0
  },
  {
    q: "At what angle of projection is the horizontal range of a projectile **maximized**?",
    a: "$$\\theta = 45^\\circ$$",
    qImg: "", aImg: "", stability: 5.0
  },
  {
    q: "What is the **Equation of Trajectory** for a projectile?",
    a: "$$y = x \\tan\\theta - \\frac{gx^2}{2u^2 \\cos^2\\theta}$$",
    qImg: "", aImg: "", stability: 1.0
  },
  {
    q: "How do you calculate the **relative velocity** of object A with respect to object B?",
    a: "$$\\vec{v}_{AB} = \\vec{v}_A - \\vec{v}_B$$",
    qImg: "", aImg: "", stability: 2.5
  },
  {
    q: "If an object covers half its total distance with speed $v_1$ and the other half with speed $v_2$, what is its **average speed**?",
    a: "Harmonic mean of the speeds:\n$$v_{avg} = \\frac{2 v_1 v_2}{v_1 + v_2}$$",
    qImg: "", aImg: "", stability: 1.0
  },
  {
    q: "What kind of motion is represented by a Position-Time graph that is a **parabola opening upwards**?",
    a: "Motion with **constant positive acceleration**.",
    qImg: "https://placehold.co/600x400/15171b/ececec?text=Upward+Parabola+(x-t)", aImg: "", stability: 2.5
  },
  {
    q: "In projectile motion, what happens to the **horizontal component of velocity** throughout the flight?",
    a: "It remains **constant** (assuming negligible air resistance) because there is no horizontal acceleration.\n$$v_x = u \\cos\\theta$$",
    qImg: "", aImg: "", stability: 5.0
  }
];

async function seed() {
  console.log('🚀 Starting Kinematics Seed Script...');

  // 1. Get an active user to assign ownership
  const { data: users, error: userError } = await supabase.from('users').select('*').limit(1);
  if (userError || !users || users.length === 0) {
    console.error('❌ Could not find a user to assign the deck to.');
    process.exit(1);
  }
  const teacherId = users[0].id;
  console.log(`👤 Assigned to user: ${teacherId}`);

  // 2. Create the Deck
  const deckId = uuidv4();
  const deckData = {
    id: deckId,
    name: 'Physics: Kinematics Masterclass',
    description: 'Master 1D and 2D kinematics, including projectile motion, relative velocity, and graphical analysis.',
    subject: 'Physics',
    prep_category: 'JEE',
    is_public: true,
    user_id: teacherId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const { error: deckError } = await supabase.from('decks').insert(deckData);
  if (deckError) {
    console.error('❌ Failed to create deck:', deckError);
    process.exit(1);
  }
  console.log(`📚 Created Deck: ${deckData.name} (ID: ${deckId})`);

  // 3. Create the Flashcards
  const flashcardInserts = kinematicsCards.map((card) => {
    const mediaUrls = [];
    if (card.qImg) mediaUrls[0] = card.qImg;
    if (card.aImg) {
      if (!mediaUrls[0]) mediaUrls[0] = '';
      mediaUrls[1] = card.aImg;
    }

    return {
      id: uuidv4(),
      deck_id: deckId,
      front: card.q,
      back: card.a,
      front_content: JSON.stringify([{ type: 'mixed', value: card.q }]),
      back_content: JSON.stringify([{ type: 'mixed', value: card.a }]),
      media_urls_json: JSON.stringify(mediaUrls),
      starting_stability: card.stability,
      status: 'published',
      content_type: 'mixed',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  });

  const { error: cardsError } = await supabase.from('flashcards').insert(flashcardInserts);
  
  if (cardsError) {
    console.error('❌ Failed to insert cards:', cardsError);
    // Cleanup deck if cards fail
    await supabase.from('decks').delete().eq('id', deckId);
    process.exit(1);
  }

  console.log(`✅ Successfully inserted ${flashcardInserts.length} Kinematics flashcards!`);
  console.log('You can now see this deck in the Web App Dashboard or sync it down to your Mobile App.');
}

seed();