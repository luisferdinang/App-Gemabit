
import React, { useState, useEffect } from 'react';
import { Quiz } from '../../types';
import { Sparkles, Brain } from 'lucide-react';
import { soundService } from '../../services/soundService';

interface Card {
  id: number;
  content: string;
  isFlipped: boolean;
  isMatched: boolean;
}

export const MemoryGame = ({ quiz, onComplete }: { quiz: Quiz, onComplete: () => void }) => {
  const [cards, setCards] = useState<Card[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // 1. Get words from options
    const items = quiz.options?.filter(o => o.trim() !== '') || ['🐶', '🐱', '🐭', '🐹'];
    
    // 2. Create pairs
    const deck = [...items, ...items];
    
    // 3. Shuffle
    const shuffled = deck
      .map(value => ({ value, sort: Math.random() }))
      .sort((a, b) => a.sort - b.sort)
      .map((item, index) => ({
        id: index,
        content: item.value,
        isFlipped: false,
        isMatched: false
      }));

    setCards(shuffled);
  }, [quiz]);

  const handleCardClick = (index: number) => {
    if (isProcessing || cards[index].isFlipped || cards[index].isMatched) return;

    // Flip card
    const newCards = [...cards];
    newCards[index].isFlipped = true;
    setCards(newCards);
    soundService.playPop();

    const newFlipped = [...flippedIndices, index];
    setFlippedIndices(newFlipped);

    // Check match if 2 cards flipped
    if (newFlipped.length === 2) {
      setIsProcessing(true);
      const [firstIdx, secondIdx] = newFlipped;
      
      if (newCards[firstIdx].content === newCards[secondIdx].content) {
        // MATCH!
        setTimeout(() => {
          newCards[firstIdx].isMatched = true;
          newCards[secondIdx].isMatched = true;
          setCards([...newCards]);
          setFlippedIndices([]);
          setIsProcessing(false);
          soundService.playCoin();

          // Check Win Condition
          if (newCards.every(c => c.isMatched)) {
             setTimeout(onComplete, 500);
          }
        }, 500);
      } else {
        // NO MATCH
        setTimeout(() => {
          newCards[firstIdx].isFlipped = false;
          newCards[secondIdx].isFlipped = false;
          setCards([...newCards]);
          setFlippedIndices([]);
          setIsProcessing(false);
        }, 1000);
      }
    }
  };

  return (
    <div className="py-4">
      <div className="grid grid-cols-4 gap-3 max-w-sm mx-auto">
        {cards.map((card, index) => (
          <button
            key={card.id}
            onClick={() => handleCardClick(index)}
            disabled={card.isMatched}
            className={`aspect-square rounded-xl text-2xl md:text-3xl flex items-center justify-center transition-all duration-300 transform perspective-1000 ${
              card.isFlipped || card.isMatched
                ? 'bg-white border-4 border-pink-400 rotate-y-180 shadow-md'
                : 'bg-pink-500 border-4 border-pink-600 hover:bg-pink-400 cursor-pointer shadow-lg'
            }`}
          >
             {card.isFlipped || card.isMatched ? (
                 <span className="animate-pop font-black text-slate-700">{card.content}</span>
             ) : (
                 <Brain className="text-white/40" size={24} />
             )}
          </button>
        ))}
      </div>
    </div>
  );
};
