import 'dotenv/config';

import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { repairedBundles } from './dsa-a2z-repaired-bundles';

type Card = { front?: unknown; back?: unknown };
type Bundle = {
  title: string;
  original_id: string;
  difficulty?: string;
  tags?: unknown;
  parent?: Card;
  children?: Card[];
  repaired?: boolean;
};
type Problem = {
  title: string;
  difficulty?: string;
  tags?: unknown;
  step_title?: string;
  sub_step_title?: string;
  original_id: string;
  flashcard_status?: string;
};

const ROADMAP = [
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
] as const;

const source = 'striver-a2z';
const ownerEmail = process.env.CRAMIT_CONTENT_OWNER_EMAIL || 'madhav24101@iiitnr.edu.in';
const apply = process.argv.includes('--apply');
const publishTest = process.argv.includes('--publish-test');
const publishAll = process.argv.includes('--publish-all');

function slug(value: string) {
  return value.toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function stableId(...parts: string[]) {
  return [source, ...parts.map(slug)].join(':');
}

function value(value: unknown) {
  return typeof value === 'string' ? value.trim() : '';
}

function toTags(valueToParse: unknown) {
  if (Array.isArray(valueToParse)) return valueToParse.map(value).filter(Boolean);
  if (typeof valueToParse === 'string') return [valueToParse.trim()].filter(Boolean);
  return [];
}

function content(valueToStore: string) {
  return [{ type: 'mixed', value: valueToStore }];
}

async function readJson<T>(fileName: string) {
  return JSON.parse(await readFile(resolve(process.cwd(), '..', fileName), 'utf8')) as T;
}

function buildRows(bundles: Bundle[], problems: Problem[]) {
  const problemById = new Map(problems.map((problem) => [problem.original_id, problem]));
  const steps = new Map<string, { number: number; sourceTitle: string; name: string }>(
    ROADMAP.map(([sourceTitle, name], index) => [
      sourceTitle,
      { number: index + 1, sourceTitle, name },
    ] as const),
  );
  const decks = new Map<string, Record<string, unknown>>();
  const problemRows: Record<string, unknown>[] = [];
  const cardRows: Record<string, unknown>[] = [];
  const skipped: Record<string, unknown>[] = [];

  for (const [sourceOrder, bundle] of bundles.entries()) {
    const problem = problemById.get(bundle.original_id);
    const step = problem ? steps.get(problem.step_title || '') : undefined;
    if (!problem || !step || (problem.flashcard_status !== 'done' && !bundle.repaired)) {
      skipped.push({ originalId: bundle.original_id, title: bundle.title, reason: !problem ? 'missing-gfg-problem' : problem.flashcard_status !== 'done' ? 'gfg-not-done' : 'unknown-roadmap-step' });
      continue;
    }

    const deckId = stableId('deck', String(step.number));
    const now = new Date().toISOString();
    decks.set(deckId, {
      id: deckId,
      name: step.name,
      description: `Striver A2Z DSA — Step ${step.number}: ${step.sourceTitle}`,
      tags_json: JSON.stringify([source, `step-${step.number}`]),
      is_premium: false,
      is_public: false,
      price: null,
      cover_image: null,
      subject: 'DSA',
      chapter: step.name,
      created_at: now,
      updated_at: now,
      user_id: '__OWNER_ID__',
      version: 1,
      deleted_at: null,
      prep_category: 'Computer Science',
    });

    const bundleId = stableId('bundle', bundle.original_id);
    const problemTags = toTags(bundle.tags ?? problem.tags);
    problemRows.push({
      id: bundleId,
      deck_id: deckId,
      original_id: bundle.original_id,
      title: bundle.title,
      difficulty: bundle.difficulty || problem.difficulty || null,
      tags_json: JSON.stringify(problemTags),
      source,
      roadmap_step: step.number,
      roadmap_step_title: step.sourceTitle,
      roadmap_sub_step_title: problem.sub_step_title || null,
      source_order: sourceOrder,
      status: 'draft',
      created_at: now,
      updated_at: now,
    });

    const rows = [
      ...(bundle.parent ? [{ ...bundle.parent, role: 'parent', childType: 'overview', position: 0 }] : []),
      ...(Array.isArray(bundle.children) ? bundle.children.map((child, index) => ({ ...child, role: 'child', childType: `child-${index + 1}`, position: index + 1 })) : []),
    ];
    rows.forEach((card, index) => {
      const front = value(card.front);
      const back = value(card.back);
      if (!front && !back) return;
      const cardTags = [...new Set([source, card.role, ...problemTags])];
      cardRows.push({
        id: stableId('card', bundle.original_id, card.role === 'parent' ? 'parent' : `child-${index}`),
        front,
        back,
        content_type: 'mixed',
        media_urls_json: '[]',
        tags_json: JSON.stringify(cardTags),
        created_at: now,
        updated_at: now,
        deck_id: deckId,
        front_content: content(front),
        back_content: content(back),
        starting_stability: 2.5,
        status: 'draft',
        problem_bundle_id: bundleId,
        card_role: card.role,
        child_type: card.childType,
        position: card.position,
        bundle_order: sourceOrder,
      });
    });
  }

  return { decks: [...decks.values()], problemRows, cardRows, skipped };
}

async function upsertChunks(client: any, table: string, rows: Record<string, unknown>[]) {
  for (let index = 0; index < rows.length; index += 100) {
    const { error } = await client.from(table).upsert(rows.slice(index, index + 100), { onConflict: 'id' });
    if (error) throw new Error(`${table} batch ${index}: ${error.message}`);
  }
}

async function main() {
  const [bundles, problems] = await Promise.all([
    readJson<Bundle[]>('flashcards_db.json'),
    readJson<Problem[]>('gfg_problems.json'),
  ]);
  const existingBundleIds = new Set(bundles.map((bundle) => bundle.original_id));
  const mergedBundles = [
    ...bundles,
    ...repairedBundles.filter((bundle) => !existingBundleIds.has(bundle.original_id)),
  ];
  const rows = buildRows(mergedBundles, problems);
  if (publishTest && publishAll) throw new Error('Choose either --publish-test or --publish-all, not both.');
  const testBundle = publishTest ? rows.problemRows[0] : undefined;
  const testDeckId = testBundle?.deck_id as string | undefined;
  const decksToWrite = testDeckId ? rows.decks.filter((deck) => deck.id === testDeckId) : rows.decks;
  const bundlesToWrite = testBundle ? rows.problemRows.filter((bundle) => bundle.id === testBundle.id) : rows.problemRows;
  const cardsToWrite = testBundle
    ? rows.cardRows.filter((card) => card.problem_bundle_id === testBundle.id)
    : rows.cardRows;

  if (publishTest) {
    if (!testBundle || !testDeckId) throw new Error('Could not find a complete bundle for the published test slice.');
    for (const deck of decksToWrite) deck.is_public = true;
    for (const bundle of bundlesToWrite) bundle.status = 'published';
    for (const card of cardsToWrite) card.status = 'published';
  }

  if (publishAll) {
    for (const deck of rows.decks) deck.is_public = true;
    for (const bundle of rows.problemRows) bundle.status = 'published';
    for (const card of rows.cardRows) card.status = 'published';
  }

  console.log(JSON.stringify({
    mode: apply ? (publishAll ? 'APPLY_ALL_PUBLISHED' : publishTest ? 'APPLY_PUBLISHED_TEST_SLICE' : 'APPLY_DRAFTS') : 'DRY_RUN',
    source,
    ownerEmail,
    decks: decksToWrite.length,
    problemBundles: bundlesToWrite.length,
    flashcards: cardsToWrite.length,
    skipped: rows.skipped,
  }, null, 2));

  if (!apply) {
    console.log('\nDry run only. No Supabase rows were changed. Use --apply after reviewing this report.');
    return;
  }

  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error('Supabase URL and service role key are required for --apply.');
  const client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });

  const { data: owners, error: ownerError } = await client
    .from('users')
    .select('id,email')
    .eq('is_admin', true);
  if (ownerError) throw ownerError;
  const owner = owners?.find((item) => item.email?.toLowerCase() === ownerEmail.toLowerCase()) ?? owners?.[0];
  if (!owner) throw new Error(`No content admin found for ${ownerEmail}.`);

  for (const deck of decksToWrite) deck.user_id = owner.id;
  await upsertChunks(client, 'decks', decksToWrite);
  await upsertChunks(client, 'problem_bundles', bundlesToWrite);
  await upsertChunks(client, 'flashcards', cardsToWrite);
  console.log(`Applied ${decksToWrite.length} deck(s), ${bundlesToWrite.length} problem bundle(s), and ${cardsToWrite.length} card(s).`);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
