import React from 'react';
import { trpc } from '../utils/trpc';
// We'll rely on TypeScript inference from the trpc object for now for deck type

const DeckList: React.FC = () => {
  // Ensure the query key matches the path in your AppRouter
  const listDecksQuery = trpc.admin.adminListDecks.useQuery({}); 

  if (listDecksQuery.isLoading) {
    return <p>Loading decks...</p>;
  }

  if (listDecksQuery.error) {
    return <p>Error loading decks: {listDecksQuery.error.message}</p>;
  }

  // Backend returns { decks: Deck[], nextCursor?: string | null }
  if (!listDecksQuery.data || !listDecksQuery.data.decks || listDecksQuery.data.decks.length === 0) {
    return <p>No decks found.</p>;
  }

  return (
    <div>
      <h2>All Decks</h2>
      <ul>
        {listDecksQuery.data.decks.map((deck) => (
          <li key={deck.id}>
            {deck.name} ({deck.isPublic ? 'Public' : 'Private'}) - Created by: {deck.user?.name || 'N/A'}
            <br />
            <small>ID: {deck.id} | Flashcards: {deck._count?.flashcards || 0}</small>
          </li>
        ))}
      </ul>
      {listDecksQuery.data.nextCursor && <p>Next cursor: {listDecksQuery.data.nextCursor}</p>}
    </div>
  );
};

export default DeckList; 