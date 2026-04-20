// Mock Data for the Frontend Revamp

export const MOCK_USER_STATS = {
  name: "Arjun",
  streak: 12,
  today: {
    reviewsCompleted: 15,
    estimatedTimeMin: 8,
  },
  subjectMastery: [
    { subject: "Physics", percentage: 68 },
    { subject: "Chemistry", percentage: 42 },
    { subject: "Maths", percentage: 85 },
  ],
  activityTrend: [
    { day: "Mon", count: 120 },
    { day: "Tue", count: 85 },
    { day: "Wed", count: 40 },
    { day: "Thu", count: 150 },
    { day: "Fri", count: 200 },
    { day: "Sat", count: 50 },
    { day: "Sun", count: 180 },
  ],
  // 90 days of heatmap data (0-4 intensity)
  heatmap: Array.from({ length: 90 }).map(() => Math.floor(Math.random() * 5)),
};

export const MOCK_CURRICULUM = {
  Physics: {
    icon: "atom", // lucide icon name
    chapters: [
      { id: "p1", name: "Kinematics 1D", subtitle: "Motion, Graphs, Velocity", selected: false },
      { id: "p2", name: "Newton's Laws", subtitle: "Dynamics, Friction, Pulleys", selected: false },
      { id: "p3", name: "Work, Power & Energy", subtitle: "Conservation, Collisions", selected: false },
      { id: "p4", name: "Rotational Motion", subtitle: "Torque, Inertia, Rolling", selected: false },
      { id: "p5", name: "Gravitation", subtitle: "Fields, Potential, Orbits", selected: false },
    ]
  },
  Chem: {
    icon: "flask-conical",
    chapters: [
      { id: "c1", name: "Atomic Structure", subtitle: "Bohr Model, Quantum Numbers", selected: false },
      { id: "c2", name: "Chemical Bonding", subtitle: "VSEPR, MOT, Hybridization", selected: false },
      { id: "c3", name: "Thermodynamics", subtitle: "Enthalpy, Entropy, Gibbs", selected: false },
      { id: "c4", name: "Equilibrium", subtitle: "Le Chatelier, Ionic Equilibrium", selected: false },
      { id: "c5", name: "Organic Chemistry", subtitle: "IUPAC, Isomerism, GOC", selected: false },
    ]
  },
  Maths: {
    icon: "function-square", // approximation for math icon
    chapters: [
      { id: "m1", name: "Calculus", subtitle: "Limits, Continuity, Differentiability", selected: false },
      { id: "m2", name: "Algebra", subtitle: "Quadratic, Sequences, Binomial", selected: false },
      { id: "m3", name: "Coordinate Geometry", subtitle: "Straight Lines, Circles, Conics", selected: false },
      { id: "m4", name: "Trigonometry", subtitle: "Ratios, Identities, Equations", selected: false },
      { id: "m5", name: "Vectors & 3D", subtitle: "Dot Product, Cross Product, Planes", selected: false },
    ]
  }
};

export const MOCK_CONTENT_TYPES = [
  { id: "ct1", label: "Formulas", icon: "function-square", selected: false },
  { id: "ct2", label: "Concepts", icon: "lightbulb", selected: false },
  { id: "ct3", label: "PYQs", icon: "file-text", selected: false },
  { id: "ct4", label: "Mistakes", icon: "alert-circle", selected: false },
];

export const MOCK_TEMP_CARDS = [
  {
    id: "card_1",
    deckId: "temp_deck",
    front: "What is Gauss's Law?",
    back: "The net electric flux through any closed surface is equal to the net charge inside the surface divided by the permittivity of free space.",
  },
  {
    id: "card_2",
    deckId: "temp_deck",
    front: "Formula for capacitance of a parallel plate capacitor?",
    back: "C = (ε₀ * A) / d",
  },
  {
    id: "card_3",
    deckId: "temp_deck",
    front: "What is the unit of Electric Field?",
    back: "Newtons per Coulomb (N/C) or Volts per meter (V/m)",
  },
  {
    id: "card_4",
    deckId: "temp_deck",
    front: "First Law of Thermodynamics?",
    back: "ΔQ = ΔU + ΔW (Energy cannot be created or destroyed, only transferred or changed in form)",
  },
  {
    id: "card_5",
    deckId: "temp_deck",
    front: "Derivative of sin(x)?",
    back: "cos(x)",
  }
];
