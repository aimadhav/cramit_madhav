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

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const physicsCards = [
  {
    q: "What is the formula for the Time of Flight of a projectile?",
    a: "$T = \\frac{2u \\sin \\theta}{g}$\n\nwhere $u$ is initial velocity, $\\theta$ is the angle of projection, and $g$ is acceleration due to gravity.",
    qImg: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/61/Ideal_projectile_motion_for_different_angles.svg/800px-Ideal_projectile_motion_for_different_angles.svg.png", 
    aImg: "", 
    stability: 2.5
  },
  {
    q: "Define the Work-Energy Theorem.",
    a: "The net work done on an object by all forces equals the change in its kinetic energy.\n\n$W_{net} = KE_f - KE_i = \\Delta KE$",
    qImg: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Work_and_kinetic_energy.svg/600px-Work_and_kinetic_energy.svg.png", 
    aImg: "", 
    stability: 2.5
  },
  {
    q: "What is the formula for the escape velocity of a planet?",
    a: "$v_e = \\sqrt{\\frac{2GM}{R}}$\n\nwhere $G$ is the gravitational constant, $M$ is the mass of the planet, and $R$ is its radius.",
    qImg: "", 
    aImg: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/07/Escape_velocity_of_Earth.svg/600px-Escape_velocity_of_Earth.svg.png", 
    stability: 2.5
  },
  {
    q: "What is the relation between Torque ($\\tau$) and Angular Momentum ($L$)?",
    a: "The net external torque acting on a system is equal to the rate of change of its angular momentum:\n$\\tau = \\frac{dL}{dt}$",
    qImg: "https://upload.wikimedia.org/wikipedia/commons/thumb/0/09/Torque_animation.gif/400px-Torque_animation.gif", 
    aImg: "", 
    stability: 2.5
  },
  {
    q: "What is the formula for Terminal Velocity of a sphere in a viscous fluid?",
    a: "$v_t = \\frac{2r^2( \\rho - \\sigma )g}{9\\eta}$\n\nwhere $r$ is radius, $\\rho$ is density of sphere, $\\sigma$ is density of fluid, and $\\eta$ is coefficient of viscosity.",
    qImg: "", 
    aImg: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Terminal_velocity_of_a_falling_sphere.svg/400px-Terminal_velocity_of_a_falling_sphere.svg.png", 
    stability: 1.0
  }
];

async function seed() {
  console.log('🚀 Starting Real Physics Seed Script...');

  const { data: users, error: userError } = await supabase.from('users').select('*').limit(1);
  if (userError || !users || users.length === 0) {
    console.error('❌ Could not find a user to assign the deck to.');
    process.exit(1);
  }
  const teacherId = users[0].id;

  const deckId = uuidv4();
  const deckData = {
    id: deckId,
    name: 'Advanced Physics (Real Images & LaTeX)',
    description: 'A test deck with real public domain physics images and properly formatted LaTeX.',
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
  console.log(`📚 Created Deck: ${deckData.name}`);

  const flashcardInserts = physicsCards.map((card) => {
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
    await supabase.from('decks').delete().eq('id', deckId);
    process.exit(1);
  }

  console.log(`✅ Successfully inserted ${flashcardInserts.length} physics flashcards with images!`);
}

seed();
