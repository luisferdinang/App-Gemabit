import React, { useState, useEffect, useMemo } from 'react';
import { Quiz } from '../../types';
import { soundService } from '../../services/soundService';
import { Check, X } from 'lucide-react';

interface MatchingGameProps {
    quiz: Quiz;
    onComplete: () => void;
    onFail: () => void;
}

export const MatchingGame: React.FC<MatchingGameProps> = ({ quiz, onComplete, onFail }) => {
    const [selectedWord, setSelectedWord] = useState<number | null>(null);
    const [selectedMeaning, setSelectedMeaning] = useState<number | null>(null);
    const [matches, setMatches] = useState<number[]>([]); // Indices of words that are matched
    const [isError, setIsError] = useState(false);

    // Shuffle logic
    const words = useMemo(() => {
        return quiz.gameItems?.map((item, i) => ({ text: item.text, originalIndex: i })) || [];
    }, [quiz.gameItems]);

    const meanings = useMemo(() => {
        const m = quiz.gameItems?.map((item, i) => ({ text: item.meaning || '', originalIndex: i })) || [];
        return [...m].sort(() => Math.random() - 0.5);
    }, [quiz.gameItems]);

    const handleWordSelect = (idx: number) => {
        if (matches.includes(idx) || isError) return;
        setSelectedWord(idx);
        soundService.playPop();
    };

    const handleMeaningSelect = (originalIndex: number) => {
        if (selectedWord === null || isError) return;

        if (selectedWord === originalIndex) {
            // Correct Match
            const newMatches = [...matches, selectedWord];
            setMatches(newMatches);
            setSelectedWord(null);
            soundService.playCoin();

            if (newMatches.length === (quiz.gameItems?.length || 0)) {
                setTimeout(onComplete, 1000);
            }
        } else {
            // Wrong Match
            setIsError(true);
            soundService.playPop(); // Or some error sound
            setTimeout(() => {
                setIsError(false);
                setSelectedWord(null);
            }, 800);
        }
    };

    return (
        <div className="space-y-6 py-2">
            <div className="grid grid-cols-2 gap-4">
                {/* Words Column */}
                <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-2">Palabras</h4>
                    {words.map((w) => (
                        <button
                            key={w.originalIndex}
                            onClick={() => handleWordSelect(w.originalIndex)}
                            disabled={matches.includes(w.originalIndex)}
                            className={`w-full p-4 rounded-2xl border-4 font-bold text-sm transition-all text-center h-20 flex items-center justify-center break-words leading-tight ${matches.includes(w.originalIndex)
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-600 opacity-50'
                                : selectedWord === w.originalIndex
                                    ? 'bg-violet-100 border-violet-500 text-violet-700 scale-105 shadow-md'
                                    : 'bg-white border-slate-100 text-slate-700 hover:border-violet-300'
                                }`}
                        >
                            {w.text}
                            {matches.includes(w.originalIndex) && <Check size={16} className="ml-2 shrink-0" />}
                        </button>
                    ))}
                </div>

                {/* Meanings Column */}
                <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center mb-2">Significados</h4>
                    {meanings.map((m, idx) => {
                        const isMatched = matches.includes(m.originalIndex);
                        const isWrong = isError && selectedWord !== null && !isMatched; // Visual feedback for errors could be improved but this works

                        return (
                            <button
                                key={idx}
                                onClick={() => handleMeaningSelect(m.originalIndex)}
                                disabled={isMatched}
                                className={`w-full p-4 rounded-2xl border-4 font-bold text-[10px] transition-all text-center h-20 flex items-center justify-center break-words leading-tight ${isMatched
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600 opacity-50'
                                    : isError && selectedWord !== null
                                        ? 'bg-rose-50 border-rose-200 text-rose-600'
                                        : 'bg-white border-slate-100 text-slate-700 hover:border-violet-300'
                                    }`}
                            >
                                {m.text}
                            </button>
                        );
                    })}
                </div>
            </div>

            {selectedWord !== null && (
                <div className="text-center animate-bounce-slow">
                    <span className="bg-violet-100 text-violet-700 px-4 py-2 rounded-full text-xs font-black uppercase border border-violet-200">
                        Ahora elige su significado
                    </span>
                </div>
            )}
        </div>
    );
};
