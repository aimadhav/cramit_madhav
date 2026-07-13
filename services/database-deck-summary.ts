import { safeParseJsonArray } from './database-content';

export type DeckRow = {
  id: string;
  tags?: string | null;
  [key: string]: any;
};

export type CardRow = {
  id: string;
  deckId: string;
};

export type StatusRow = {
  flashcardId: string;
  due_date: number;
};

export function buildCardsByDeck(allCards: CardRow[]) {
  const cardsByDeck = new Map<string, CardRow[]>();

  for (const card of allCards) {
    const existing = cardsByDeck.get(card.deckId) || [];
    existing.push(card);
    cardsByDeck.set(card.deckId, existing);
  }

  return cardsByDeck;
}

export function buildDeckSummary(deck: DeckRow, now: number, cardsByDeck: Map<string, CardRow[]>, reviewedCardIds: Set<string>, dueCardIds: Set<string>) {
  const deckCards = cardsByDeck.get(deck.id) || [];
  const totalCards = deckCards.length;

  const dueInThisDeck = deckCards.filter(card => dueCardIds.has(card.id)).length;
  const newInThisDeck = deckCards.filter(card => !reviewedCardIds.has(card.id)).length;

  return {
    ...deck,
    cardCount: totalCards,
    dueCount: dueInThisDeck + newInThisDeck,
    tags: safeParseJsonArray(deck.tags, []),
    updatedAt: deck.updatedAt ?? now,
  };
}
