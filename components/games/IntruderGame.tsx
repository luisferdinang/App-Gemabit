import React from 'react';
import { Quiz } from '../../types';

export const IntruderGame = ({ quiz, onComplete }: { quiz: Quiz, onComplete: () => void }) => {
  const handleSelect = (index: number) => { if (index === quiz.correctIndex) { onComplete(); } else { alert("Ese sí pertenece al grupo. ¡Busca el diferente!"); } };
  return ( <div className="grid grid-cols-2 gap-4 py-4"> {quiz.options?.map((opt, idx) => ( <button key={idx} onClick={() => handleSelect(idx)} className="aspect-square bg-white rounded-3xl border-4 border-slate-100 shadow-sm hover:border-indigo-400 hover:shadow-lg transition-all flex items-center justify-center p-4 active:scale-95 group" > <span className="font-black text-slate-700 text-lg group-hover:text-indigo-600">{opt}</span> </button> ))} </div> );
};