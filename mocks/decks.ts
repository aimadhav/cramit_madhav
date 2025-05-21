import { Deck } from '@/types';

export const mockDecks: Deck[] = [
  {
    id: 'deck-1',
    name: 'Physics Mechanics',
    description: "Essential concepts in mechanics for JEE preparation",
    cardCount: 45,
    tags: ['physics', 'mechanics', 'jee'],
    isPremium: false,
    createdAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
    subject: 'Physics',
    chapter: 'Mechanics'
  },
  {
    id: 'deck-2',
    name: 'Organic Chemistry',
    description: "Important organic chemistry reactions for JEE and NEET",
    cardCount: 60,
    tags: ['chemistry', 'organic', 'reactions', 'jee', 'neet'],
    isPremium: true,
    price: 199,
    createdAt: Date.now() - 45 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
    subject: 'Chemistry',
    chapter: 'Organic Chemistry'
  },
  {
    id: 'deck-3',
    name: 'Mathematics Calculus',
    description: "Calculus concepts and problem-solving techniques",
    cardCount: 50,
    tags: ['mathematics', 'calculus', 'jee'],
    isPremium: false,
    createdAt: Date.now() - 60 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
    subject: 'Mathematics',
    chapter: 'Calculus'
  },
  {
    id: 'deck-4',
    name: 'Biology Physiology',
    description: "Comprehensive coverage of human physiology for NEET",
    cardCount: 75,
    tags: ['biology', 'physiology', 'neet'],
    isPremium: true,
    price: 249,
    createdAt: Date.now() - 20 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
    subject: 'Biology',
    chapter: 'Human Physiology'
  },
  {
    id: 'deck-5',
    name: 'Chemistry Periodic',
    description: "All you need to know about the periodic table",
    cardCount: 35,
    tags: ['chemistry', 'periodic table', 'jee', 'neet'],
    isPremium: false,
    createdAt: Date.now() - 15 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
    subject: 'Chemistry',
    chapter: 'Periodic Table'
  },
  {
    id: 'deck-6',
    name: 'Physics Electro',
    description: "Master electromagnetic concepts and applications",
    cardCount: 55,
    tags: ['physics', 'electromagnetism', 'jee'],
    isPremium: true,
    price: 199,
    createdAt: Date.now() - 25 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
    subject: 'Physics',
    chapter: 'Electromagnetism'
  },
  {
    id: 'deck-7',
    name: 'Biomolecules',
    description: "Key concepts and structures of biomolecules for biology students.",
    cardCount: 5,
    tags: ['biology', 'biochemistry', 'molecules', 'neet'],
    isPremium: false,
    createdAt: Date.now() - 10 * 24 * 60 * 60 * 1000,
    updatedAt: Date.now(),
    subject: 'Biology',
    chapter: 'Biomolecules'
  }
];