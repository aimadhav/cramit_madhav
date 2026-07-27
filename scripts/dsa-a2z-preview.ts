import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

type RawCard = {
  front?: unknown;
  back?: unknown;
};

type FlashcardBundle = {
  title: string;
  original_id: string;
  difficulty?: string;
  tags?: unknown;
  parent?: RawCard;
  children?: RawCard[];
  generated_at?: string;
};

type GfgProblem = {
  title: string;
  difficulty?: string;
  tags?: unknown;
  description?: string;
  step_title?: string;
  sub_step_title?: string;
  original_id: string;
  flashcard_status?: string;
};

type RoadmapStep = {
  number: number;
  sourceTitle: string;
  name: string;
  slug: string;
};

const ROADMAP: RoadmapStep[] = [
  ['Learn the basics', 'Basics'],
  ['Learn Important Sorting Techniques', 'Sorting'],
  ['Solve Problems on Arrays [Easy -> Medium -> Hard]', 'Arrays'],
  ['Binary Search [1D, 2D Arrays, Search Space]', 'Binary Search'],
  ['Strings [Basic and Medium]', 'Strings'],
  ['Learn LinkedList [Single LL, Double LL, Medium, Hard Problems]', 'Linked List'],
  ['Recursion [PatternWise]', 'Recursion'],
  ['Bit Manipulation [Concepts & Problems]', 'Bit Manipulation'],
  ['Stack and Queues [Learning, Pre-In-Post-fix, Monotonic Stack, Implementation]', 'Stack and Queues'],
  ['Sliding Window & Two Pointer Combined Problems', 'Sliding Window and Two Pointer'],
  ['Heaps [Learning, Medium, Hard Problems]', 'Heaps'],
  ['Greedy Algorithms [Easy, Medium/Hard]', 'Greedy Algorithms'],
  ['Binary Trees [Traversals, Medium and Hard Problems]', 'Binary Trees'],
  ['Binary Search Trees [Concept and Problems]', 'Binary Search Trees'],
  ['Graphs [Concepts & Problems]', 'Graphs'],
  ['Dynamic Programming [Patterns and Problems]', 'Dynamic Programming'],
  ['Tries', 'Tries'],
  ['Strings', 'Advanced Strings'],
].map(([sourceTitle, name], index) => ({
  number: index + 1,
  sourceTitle,
  name,
  slug: slugify(name),
}));

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function text(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function tags(value: unknown) {
  if (Array.isArray(value)) return value.map(text).filter(Boolean);
  if (typeof value === 'string') return [value.trim()].filter(Boolean);
  return [];
}

function stableId(...parts: string[]) {
  return ['striver-a2z', ...parts.map((part) => slugify(part))].join(':');
}

function roadmapStepFor(problem: GfgProblem) {
  return ROADMAP.find((step) => step.sourceTitle === problem.step_title) ?? null;
}

function problemSourceStatus(problem: GfgProblem) {
  return problem.flashcard_status === 'done' ? 'ready' : 'missing-flashcards';
}

function parseArgs() {
  const args = new Set(process.argv.slice(2));
  return { pretty: args.has('--pretty'), summary: args.has('--summary') };
}

async function loadJson<T>(fileName: string) {
  const filePath = resolve(process.cwd(), '..', fileName);
  return JSON.parse(await readFile(filePath, 'utf8')) as T;
}

async function main() {
  const [bundles, problems] = await Promise.all([
    loadJson<FlashcardBundle[]>('flashcards_db.json'),
    loadJson<GfgProblem[]>('gfg_problems.json'),
  ]);

  const problemById = new Map(problems.map((problem) => [problem.original_id, problem]));
  const bundleIds = new Set(bundles.map((bundle) => bundle.original_id));
  const duplicateBundleIds = findDuplicates(bundles.map((bundle) => bundle.original_id));
  const duplicateProblemIds = findDuplicates(problems.map((problem) => problem.original_id));

  const steps = new Map<string, {
    step: RoadmapStep;
    problems: number;
    cards: number;
    subSteps: Map<string, number>;
  }>();
  const missingStepProblems: Array<{ originalId: string; title: string; sourceStep: string | null }> = [];
  const missingFlashcardBundles: Array<{ originalId: string; title: string; step: string | null }> = [];
  const previewBundles: Array<Record<string, unknown>> = [];
  let importedCards = 0;

  for (const [sourceOrder, bundle] of bundles.entries()) {
    const problem = problemById.get(bundle.original_id);
    if (!problem) {
      missingStepProblems.push({ originalId: bundle.original_id, title: bundle.title, sourceStep: null });
      continue;
    }

    const step = roadmapStepFor(problem);
    if (!step) {
      missingStepProblems.push({
        originalId: bundle.original_id,
        title: bundle.title,
        sourceStep: problem.step_title ?? null,
      });
      continue;
    }

    const children = Array.isArray(bundle.children) ? bundle.children : [];
    const cardCount = (bundle.parent ? 1 : 0) + children.length;
    importedCards += cardCount;

    const existing = steps.get(step.slug) ?? {
      step,
      problems: 0,
      cards: 0,
      subSteps: new Map<string, number>(),
    };
    existing.problems += 1;
    existing.cards += cardCount;
    const subStep = problem.sub_step_title || '(Unspecified)';
    existing.subSteps.set(subStep, (existing.subSteps.get(subStep) ?? 0) + 1);
    steps.set(step.slug, existing);

    previewBundles.push({
      bundleId: stableId('bundle', bundle.original_id),
      originalId: bundle.original_id,
      title: bundle.title,
      deck: {
        id: stableId('deck', String(step.number)),
        name: step.name,
        sourceStep: step.sourceTitle,
        stepNumber: step.number,
      },
      sourceSubStep: problem.sub_step_title ?? null,
      difficulty: bundle.difficulty || problem.difficulty || null,
      tags: tags(bundle.tags ?? problem.tags),
      sourceOrder,
      status: 'draft',
      cards: [
        ...(bundle.parent ? [{ id: stableId('card', bundle.original_id, 'parent'), role: 'parent', position: 0 }] : []),
        ...children.map((_, index) => ({
          id: stableId('card', bundle.original_id, `child-${index + 1}`),
          role: 'child',
          position: index + 1,
        })),
      ],
    });
  }

  for (const problem of problems) {
    if (!bundleIds.has(problem.original_id) && problemSourceStatus(problem) === 'missing-flashcards') {
      missingFlashcardBundles.push({
        originalId: problem.original_id,
        title: problem.title,
        step: problem.step_title ?? null,
      });
    }
  }

  const report = {
    source: 'Striver A2Z DSA',
    importStatus: 'draft',
    bundleCount: previewBundles.length,
    importedCards,
    gfgProblemCount: problems.length,
    roadmapStepCount: ROADMAP.length,
    duplicateBundleIds,
    duplicateProblemIds,
    missingStepProblems,
    missingFlashcardBundles,
    steps: [...steps.values()].map((entry) => ({
      number: entry.step.number,
      name: entry.step.name,
      sourceTitle: entry.step.sourceTitle,
      problems: entry.problems,
      cards: entry.cards,
      subSteps: [...entry.subSteps].map(([name, count]) => ({ name, problems: count })),
    })).sort((a, b) => a.number - b.number),
    previewBundles,
  };

  const { pretty, summary } = parseArgs();
  console.log(JSON.stringify(summary ? { ...report, previewBundles: undefined } : report, null, pretty ? 2 : 0));
}

function findDuplicates(values: string[]) {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts].filter(([, count]) => count > 1).map(([value, count]) => ({ value, count }));
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
