
import React, { useState, useEffect } from 'react';
import { Quiz } from '../../types';
import { ArrowDown, CheckCircle2 } from 'lucide-react';
import { soundService } from '../../services/soundService';

export const SequenceGame = ({ quiz, onComplete }: { quiz: Quiz, onComplete: () => void }) => {
  const [items, setItems] = useState<{id: string, text: string}[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [completedItems, setCompletedItems] = useState<string[]>([]);
  const [shakeId, setShakeId] = useState<string | null>(null);

  // Original correct order comes from quiz.options
  const correctOrder = quiz.options || [];

  useEffect(() => {
    if (correctOrder.length > 0) {
      // Create objects with IDs to handle duplicates if any, though not expected
      const mapped = correctOrder.map((text, idx) => ({ id: `${idx}-${text}`, text }));
      // Shuffle
      const shuffled = [...mapped].sort(() => Math.random() - 0.5);
      setItems(shuffled);
      setCompletedItems([]);
      setCurrentIndex(0);
    }
  }, [quiz]);

  const handleSelect = (item: {id: string, text: string}) => {
    if (shakeId) return; // Wait for animation

    const expectedText = correctOrder[currentIndex];
    
    if (item.text === expectedText) {
      // Correct!
      soundService.playCoin();
      setCompletedItems(prev => [...prev, item.text]);
      setItems(prev => prev.filter(i => i.id !== item.id));
      
      const nextIndex = currentIndex + 1;
      setCurrentIndex(nextIndex);

      if (nextIndex >= correctOrder.length) {
        setTimeout(onComplete, 500);
      }
    } else {
      // Incorrect
      soundService.playPop();
      setShakeId(item.id);
      setTimeout(() => setShakeId(null), 500);
    }
  };

  return (
    <div className="space-y-6 py-4">
      
      {/* AREA DE PROGRESO (LOS QUE YA ORDENÓ) */}
      <div className="flex flex-col gap-2 items-center min-h-[100px] justify-end pb-4">
         {completedItems.map((text, idx) => (
            <div key={idx} className="bg-emerald-100 text-emerald-800 border-2 border-emerald-300 px-6 py-3 rounded-xl font-black w-full max-w-xs text-center flex items-center justify-between animate-pop">
               <span className="bg-emerald-200 text-emerald-700 w-6 h-6 rounded-full flex items-center justify-center text-xs mr-2">{idx + 1}</span>
               {text}
               <CheckCircle2 size={18} className="text-emerald-600 ml-2" />
            </div>
         ))}
         
         {/* INDICADOR DEL SIGUIENTE PASO */}
         {currentIndex < correctOrder.length && (
             <div className="border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 px-6 py-3 rounded-xl font-bold w-full max-w-xs text-center flex items-center justify-center gap-2">
                <span className="bg-slate-200 text-slate-500 w-6 h-6 rounded-full flex items-center justify-center text-xs">{currentIndex + 1}</span>
                ???
             </div>
         )}
      </div>

      <div className="flex justify-center">
         <ArrowDown className="text-slate-300 animate-bounce" />
      </div>

      {/* OPCIONES DESORDENADAS */}
      <div className="grid grid-cols-2 gap-3">
         {items.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelect(item)}
              className={`p-4 rounded-2xl font-black text-sm shadow-sm border-b-4 transition-all active:scale-95 active:border-b-0 active:translate-y-1 
                ${shakeId === item.id 
                    ? 'bg-red-100 border-red-300 text-red-600 animate-shake' 
                    : 'bg-white border-slate-200 text-slate-700 hover:border-cyan-300 hover:bg-cyan-50'
                }`}
              style={shakeId === item.id ? { transform: 'translateX(-5px)' } : {}}
            >
               {item.text}
            </button>
         ))}
      </div>
      
      <style>{`
        @keyframes shake {
          0% { transform: translateX(0); }
          25% { transform: translateX(-5px); }
          50% { transform: translateX(5px); }
          75% { transform: translateX(-5px); }
          100% { transform: translateX(0); }
        }
        .animate-shake {
          animation: shake 0.4s cubic-bezier(.36,.07,.19,.97) both;
        }
      `}</style>
    </div>
  );
};
