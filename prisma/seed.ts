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

  // Create decks based on mock data
  const decks = [
    {
      id: 'deck-1',
      name: 'Physics Mechanics',
      description: 'Essential concepts in mechanics for JEE preparation',
      tagsJson: JSON.stringify(['physics', 'mechanics', 'jee']),
      isPremium: false,
      isPublic: true,
      subject: 'Physics',
      chapter: 'Mechanics',
      userId: user.id,
    },
    {
      id: 'deck-2',
      name: 'Organic Chemistry',
      description: 'Important organic chemistry reactions for JEE and NEET',
      tagsJson: JSON.stringify(['chemistry', 'organic', 'reactions', 'jee', 'neet']),
      isPremium: true,
      isPublic: true,
      price: 199,
      subject: 'Chemistry',
      chapter: 'Organic Chemistry',
      userId: user.id,
    },
    {
      id: 'deck-3',
      name: 'Mathematics Calculus',
      description: 'Calculus concepts and problem-solving techniques',
      tagsJson: JSON.stringify(['mathematics', 'calculus', 'jee']),
      isPremium: false,
      isPublic: true,
      subject: 'Mathematics',
      chapter: 'Calculus',
      userId: user.id,
    },
    {
      id: 'deck-4',
      name: 'Biology Physiology',
      description: 'Comprehensive coverage of human physiology for NEET',
      tagsJson: JSON.stringify(['biology', 'physiology', 'neet']),
      isPremium: true,
      isPublic: true,
      price: 249,
      subject: 'Biology',
      chapter: 'Human Physiology',
      userId: user.id,
    },
    {
      id: 'deck-7',
      name: 'Biomolecules',
      description: 'Key concepts and structures of biomolecules for biology students.',
      tagsJson: JSON.stringify(['biology', 'biochemistry', 'molecules', 'neet']),
      isPremium: false,
      isPublic: true,
      subject: 'Biology',
      chapter: 'Biomolecules',
      userId: user.id,
    },
  ];

  for (const deckData of decks) {
    const deck = await prisma.deck.create({ data: deckData });
    console.log('✅ Created deck:', deck.name);
  }

  // Create flashcards based on mock data
  const flashcards = [
    // Physics - Mechanics
    {
      id: 'card-1',
      front: "Newton's First Law of Motion",
      back: "An object at rest stays at rest, and an object in motion stays in motion with the same speed and direction, unless acted upon by an external force.",
      contentType: 'text',
      tagsJson: JSON.stringify(['physics', 'mechanics', 'newton laws']),
      deckId: 'deck-1',
    },
    {
      id: 'card-2',
      front: "Newton's Second Law of Motion",
      back: "The acceleration of an object is directly proportional to the net force acting on it and inversely proportional to its mass.\n\n$F = ma$",
      contentType: 'mixed',
      tagsJson: JSON.stringify(['physics', 'mechanics', 'newton laws']),
      deckId: 'deck-1',
    },
    {
      id: 'card-3',
      front: "Newton's Third Law of Motion",
      back: "For every action, there is an equal and opposite reaction.",
      contentType: 'text',
      tagsJson: JSON.stringify(['physics', 'mechanics', 'newton laws']),
      deckId: 'deck-1',
    },
    {
      id: 'card-4',
      front: "What is the formula for kinetic energy?",
      back: "The kinetic energy of an object is given by:\n\n$KE = \\frac{1}{2}mv^2$\n\nwhere $m$ is the mass and $v$ is the velocity.",
      contentType: 'mixed',
      tagsJson: JSON.stringify(['physics', 'mechanics', 'energy']),
      deckId: 'deck-1',
    },
    {
      id: 'card-12',
      front: "What is the Schrödinger equation?",
      back: "The time-dependent Schrödinger equation is:\n\n$i\\hbar\\frac{\\partial}{\\partial t}\\Psi(\\mathbf{r},t) = \\hat H\\Psi(\\mathbf{r},t)$\n\nwhere $\\Psi$ is the wave function, $\\hbar$ is the reduced Planck constant, and $\\hat H$ is the Hamiltonian operator.",
      contentType: 'latex',
      tagsJson: JSON.stringify(['physics', 'quantum mechanics', 'equations']),
      deckId: 'deck-1',
    },

    // Organic Chemistry
    {
      id: 'card-5',
      front: "What is the Markovnikov's rule?",
      back: "In the addition of a protic acid HX to an alkene, the hydrogen atom attaches to the carbon with more hydrogen substituents, and the halide group attaches to the carbon with fewer hydrogen substituents.",
      contentType: 'text',
      tagsJson: JSON.stringify(['chemistry', 'organic', 'reactions']),
      deckId: 'deck-2',
    },
    {
      id: 'card-6',
      front: "Explain SN1 reaction mechanism",
      back: "SN1 (Substitution Nucleophilic Unimolecular) is a two-step reaction:\n\n1. Slow formation of a carbocation\n2. Fast attack by the nucleophile\n\nRate = k[R-LG]",
      contentType: 'text',
      tagsJson: JSON.stringify(['chemistry', 'organic', 'reactions', 'substitution']),
      deckId: 'deck-2',
    },
    {
      id: 'card-15',
      front: "Explain the concept of activation energy in chemical reactions",
      back: "Activation energy is the minimum energy required for a chemical reaction to occur. It's the energy barrier that reactants must overcome to form products.\n\n$E_a$ in the Arrhenius equation: $k = A e^{-E_a/RT}$\n\nwhere $k$ is the rate constant, $A$ is the pre-exponential factor, $R$ is the gas constant, and $T$ is temperature.",
      contentType: 'mixed',
      mediaUrlsJson: JSON.stringify(['assets/images/favicon.png']),
      tagsJson: JSON.stringify(['chemistry', 'kinetics', 'thermodynamics']),
      deckId: 'deck-2',
    },

    // Mathematics - Calculus
    {
      id: 'card-7',
      front: "What is the derivative of $e^x$?",
      back: "$\\frac{d}{dx}(e^x) = e^x$",
      contentType: 'latex',
      tagsJson: JSON.stringify(['mathematics', 'calculus', 'derivatives']),
      deckId: 'deck-3',
    },
    {
      id: 'card-8',
      front: "State the Chain Rule for derivatives",
      back: "If $y = f(g(x))$, then $\\frac{dy}{dx} = \\frac{dy}{du} \\cdot \\frac{du}{dx}$ where $u = g(x)$.\n\nIn Leibniz notation: $\\frac{dy}{dx} = \\frac{dy}{du} \\cdot \\frac{du}{dx}$",
      contentType: 'mixed',
      tagsJson: JSON.stringify(['mathematics', 'calculus', 'derivatives']),
      deckId: 'deck-3',
    },
    {
      id: 'card-14',
      front: "What is the Pythagorean theorem?",
      back: "In a right triangle, the square of the length of the hypotenuse equals the sum of the squares of the lengths of the other two sides.\n\n$a^2 + b^2 = c^2$\n\nwhere $c$ is the length of the hypotenuse, and $a$ and $b$ are the lengths of the other two sides.",
      contentType: 'mixed',
      mediaUrlsJson: JSON.stringify(['assets/images/favicon.png']),
      tagsJson: JSON.stringify(['mathematics', 'geometry', 'theorems']),
      deckId: 'deck-3',
    },

    // Biology - Physiology
    {
      id: 'card-9',
      front: "What are the four chambers of the human heart?",
      back: "The four chambers of the human heart are:\n\n1. Right atrium\n2. Right ventricle\n3. Left atrium\n4. Left ventricle",
      contentType: 'text',
      mediaUrlsJson: JSON.stringify(['assets/images/favicon.png']),
      tagsJson: JSON.stringify(['biology', 'physiology', 'heart']),
      deckId: 'deck-4',
    },
    {
      id: 'card-10',
      front: "Explain the process of synaptic transmission",
      back: "Synaptic transmission is the process by which a neuron communicates with a target cell across a synapse. Steps include:\n\n1. Action potential arrives at presynaptic terminal\n2. Voltage-gated Ca²⁺ channels open\n3. Ca²⁺ influx triggers release of neurotransmitters\n4. Neurotransmitters bind to receptors on postsynaptic membrane\n5. Postsynaptic response is generated",
      contentType: 'text',
      tagsJson: JSON.stringify(['biology', 'physiology', 'nervous system']),
      deckId: 'deck-4',
    },
    {
      id: 'card-13',
      front: "Explain the structure of DNA",
      back: "DNA (deoxyribonucleic acid) has a double helix structure with two strands running in opposite directions. The strands are made of alternating phosphate and sugar groups, with nitrogenous bases (A, T, G, C) paired between strands (A with T, G with C).",
      contentType: 'mixed',
      mediaUrlsJson: JSON.stringify(['assets/images/favicon.png']),
      tagsJson: JSON.stringify(['biology', 'genetics', 'molecular biology']),
      deckId: 'deck-4',
    },

    // Biomolecules
    {
      id: 'card-bio-1',
      front: "What are the four major types of biomolecules?",
      back: "The four major types of biomolecules are: carbohydrates, lipids, proteins, and nucleic acids.",
      contentType: 'text',
      tagsJson: JSON.stringify(['biology', 'biomolecules', 'macromolecules']),
      deckId: 'deck-7',
    },
    {
      id: 'card-bio-2',
      front: "What is the basic monomer of a protein?",
      back: "The basic monomer of a protein is an amino acid.",
      contentType: 'text',
      tagsJson: JSON.stringify(['biology', 'biomolecules', 'proteins', 'amino acids']),
      deckId: 'deck-7',
    },
    {
      id: 'card-bio-3',
      front: "Describe the primary structure of a protein.",
      back: "The primary structure of a protein refers to the linear sequence of amino acids in the polypeptide chain.",
      contentType: 'text',
      tagsJson: JSON.stringify(['biology', 'biomolecules', 'proteins', 'protein structure']),
      deckId: 'deck-7',
    },
  ];

  for (const cardData of flashcards) {
    const flashcard = await prisma.flashcard.create({ data: cardData });
    console.log('✅ Created flashcard:', flashcard.front.substring(0, 30) + '...');
    
    // Create user flashcard status for SRS
    await prisma.userFlashcardStatus.create({
      data: {
        userId: user.id,
        flashcardId: flashcard.id,
        interval: 1,
        easeFactor: 2.5,
        repetitions: 0,
        dueDate: new Date(),
        isBookmarked: Math.random() > 0.8, // 20% chance of being bookmarked
      },
    });
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

  console.log('🎉 Database seeded successfully!');
  console.log(`Created:`);
  console.log(`- 1 user`);
  console.log(`- ${decks.length} decks`);
  console.log(`- ${flashcards.length} flashcards`);
  console.log(`- ${flashcards.length} user flashcard statuses`);
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