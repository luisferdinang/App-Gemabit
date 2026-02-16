import React from 'react';
import { Quiz } from '../../types';
import { Octagon } from 'lucide-react'; // Example, since Intruder is about finding the odd one out

interface IntruderGameProps {
  quiz: Quiz;
  onComplete: () => void;
  onFail: () => void;
}

export const IntruderGame: React.FC<IntruderGameProps> = ({ quiz, onComplete, onFail }) => {
  const handleSelect = (index: number) => {
    if (index === quiz.correctIndex) {
      onComplete();
    } else {
      // Incorrect - FAIL
      // alert("Ese sí pertenece al grupo. ¡Busca el diferente!");
      onFail();
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4 py-4">
      {quiz.options?.map((opt, idx) => (
        <button
          key={idx}
          onClick={() => handleSelect(idx)}
          className="aspect-square bg-white rounded-3xl border-4 border-slate-100 shadow-sm hover:border-indigo-400 hover:shadow-lg transition-all flex items-center justify-center p-4 active:scale-95 group relative overflow-hidden"
        >
          <span className="font-black text-slate-700 text-lg group-hover:text-indigo-600 relative z-10 break-words text-center leading-tight">
            {opt}
          </span>
          <div className="absolute inset-0 bg-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
        </button>
      ))}
    </div>
  );
};