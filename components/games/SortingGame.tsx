import React, { useState, useEffect } from 'react';
import { Quiz, QuizGameItem, ExpenseCategory } from '../../types';
import { Check, Sparkles } from 'lucide-react';

interface SortingGameProps {
  quiz: Quiz;
  onComplete: () => void;
  onFail: () => void;
}

export const SortingGame: React.FC<SortingGameProps> = ({ quiz, onComplete, onFail }) => {
  const [queue, setQueue] = useState<QuizGameItem[]>([]);
  const [currentItem, setCurrentItem] = useState<QuizGameItem | null>(null);

  useEffect(() => {
    if (quiz.gameItems) {
      setQueue([...quiz.gameItems]);
    }
  }, [quiz]);

  useEffect(() => {
    if (queue.length > 0 && !currentItem) {
      setCurrentItem(queue[0]);
    } else if (queue.length === 0 && !currentItem && quiz.gameItems && quiz.gameItems.length > 0) {
      // Only complete if we processed items (queue empty because we finished)
      // Initial load might have queue empty but that's handled by first useEffect
      onComplete();
    }
  }, [queue, currentItem, onComplete, quiz.gameItems]);

  const handleSort = (category: ExpenseCategory) => {
    if (!currentItem) return;

    if (currentItem.category === category) {
      // Correct
      setQueue(prev => prev.slice(1));
      setCurrentItem(null);
    } else {
      // Incorrect - FAIL
      // alert(`¡Ops! ${currentItem.text} es ${currentItem.category === 'NEED' ? 'una Necesidad' : 'un Capricho'}.`);
      onFail();
    }
  };

  if (!currentItem) return <div className="text-center font-bold text-slate-400">¡Terminado!</div>;

  return (
    <div className="space-y-8 py-4">
      <div className="flex justify-center">
        <div className="w-40 h-40 bg-white rounded-[2rem] shadow-xl border-4 border-slate-100 flex items-center justify-center p-4 text-center animate-bounce-slow relative z-10">
          <span className="text-2xl font-black text-slate-700 break-words leading-tight">{currentItem.text}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <button
          onClick={() => handleSort('NEED')}
          className="flex flex-col items-center gap-2 bg-emerald-100 hover:bg-emerald-200 border-4 border-emerald-300 rounded-3xl p-6 transition-colors active:scale-95"
        >
          <div className="p-3 bg-emerald-500 text-white rounded-full shadow-sm"><Check size={32} /></div>
          <span className="font-black text-emerald-800 uppercase tracking-wider text-sm">Necesidad</span>
        </button>

        <button
          onClick={() => handleSort('WANT')}
          className="flex flex-col items-center gap-2 bg-rose-100 hover:bg-rose-200 border-4 border-rose-300 rounded-3xl p-6 transition-colors active:scale-95"
        >
          <div className="p-3 bg-rose-500 text-white rounded-full shadow-sm"><Sparkles size={32} /></div>
          <span className="font-black text-rose-800 uppercase tracking-wider text-sm">Capricho</span>
        </button>
      </div>
    </div>
  );
};