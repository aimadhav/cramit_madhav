import React from 'react';
import DeckList from './components/DeckList'; // Import the DeckList component
import './App.css'; // Assuming you might have some global styles

function App() {
  return (
    <div>
      <header>
        <h1>CramItFinal Admin Panel</h1>
      </header>
      <main>
        <DeckList />
      </main>
      <footer>
        <p>&copy; {new Date().getFullYear()} CramItFinal</p>
      </footer>
    </div>
  );
}

export default App;
