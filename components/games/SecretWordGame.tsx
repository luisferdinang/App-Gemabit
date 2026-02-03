import React, { useState, useEffect, useMemo } from 'react';
import { Quiz } from '../../types';
import { Heart, RefreshCw } from 'lucide-react';
import { soundService } from '../../services/soundService';

export const SecretWordGame = ({ quiz, onComplete }: { quiz: Quiz, onComplete: () => void }) => {
  // FIX: Check options[0] first as the answer is now stored there to avoid schema errors
  const originalWord = (quiz.answer || (quiz.options && quiz.options[0]) || '').trim().toUpperCase();
  
  // Custom normalization: Accents -> Base, but keep Ñ
  const normalizeChar = (char: string) => {
      return char
        .replace(/[ÁÀÄÂ]/g, 'A')
        .replace(/[ÉÈËÊ]/g, 'E')
        .replace(/[ÍÌÏÎ]/g, 'I')
        .replace(/[ÓÒÖÔ]/g, 'O')
        .replace(/[ÚÙÜÛ]/g, 'U');
      // Ñ is NOT replaced, so it stays Ñ
  };

  const normalizedSecret = useMemo(() => {
      return originalWord.split('').map(normalizeChar).join('');
  }, [originalWord]);

  const [guessedLetters, setGuessedLetters] = useState<Set<string>>(new Set());
  const [mistakes, setMistakes] = useState(0);
  const maxLives = 6;

  const handleGuess = (letter: string) => {
    if (guessedLetters.has(letter) || mistakes >= maxLives) return;

    const newGuessed = new Set(guessedLetters);
    newGuessed.add(letter);
    setGuessedLetters(newGuessed);

    // Check against normalized secret (where Ñ is Ñ, but Á is A)
    if (!normalizedSecret.includes(letter)) {
      setMistakes(prev => prev + 1);
      soundService.playPop(); 
    } else {
      soundService.playCoin();
    }
  };

  useEffect(() => {
    if (!normalizedSecret) return;
    
    // Win Condition: All alpha characters in normalizedSecret must be in guessedLetters
    const isWin = normalizedSecret.split('').every(char => {
        if (!"ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".includes(char)) return true; // Ignore spaces/symbols
        return guessedLetters.has(char);
    });

    if (isWin && normalizedSecret.length > 0) {
      setTimeout(onComplete, 1000);
    }
  }, [guessedLetters, normalizedSecret]);

  useEffect(() => {
      if (mistakes >= maxLives) {
          alert(`¡Oh no! Se acabaron los intentos. La palabra era: ${originalWord}`);
      }
  }, [mistakes]);

  if (!originalWord) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-slate-50 rounded-[2.5rem] border-2 border-slate-200 border-dashed text-center">
        <div className="bg-white p-4 rounded-full mb-3 shadow-sm text-slate-300">
            <RefreshCw size={32} />
        </div>
        <p className="text-slate-500 font-bold mb-1">¡Ups! Hubo un problema.</p>
        <p className="text-xs text-slate-400 max-w-xs mx-auto">
            La palabra secreta no se guardó correctamente. Dile a tu maestra que edite este juego.
        </p>
      </div>
    );
  }

  const alphabet = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split('');

  return (
    <div className="space-y-8">
       {/* Hearts */}
       <div className="flex justify-center gap-2 mb-4 bg-pink-50 p-2 rounded-2xl w-fit mx-auto border border-pink-100">
          {[...Array(maxLives)].map((_, i) => (
             <Heart 
               key={i} 
               size={28} 
               className={`${i < (maxLives - mistakes) ? 'text-pink-500 fill-pink-500 animate-pulse' : 'text-slate-200 fill-slate-200'}`} 
             />
          ))}
       </div>

       {/* Word Display (Improved Dashes) */}
       <div className="flex flex-wrap justify-center gap-3 min-h-[100px] px-2">
          {originalWord.split('').map((originalChar, index) => {
             const normChar = normalizeChar(originalChar);
             const isSpace = originalChar === ' ';
             const isSymbol = !"ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".includes(normChar);
             const isGuessed = guessedLetters.has(normChar);
             
             // Show if guessed, space, or special symbol
             const isVisible = isGuessed || isSpace || isSymbol;

             if (isSpace) {
                 return <div key={index} className="w-6"></div>;
             }

             return (
               <div key={index} className="flex flex-col items-center justify-end w-10 h-16 relative">
                   {/* Letter */}
                   <span className={`font-black text-3xl text-slate-800 mb-1 transition-all duration-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}>
                        {originalChar}
                   </span>
                   {/* Dash/Line */}
                   <div className="w-full h-1.5 bg-slate-800 rounded-full opacity-80"></div>
               </div>
             )
          })}
       </div>

       {/* Keyboard (Larger Keys) */}
       <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto pt-4">
          {alphabet.map(letter => {
             const isGuessed = guessedLetters.has(letter);
             const isCorrect = normalizedSecret.includes(letter);
             
             let btnClass = "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm";
             if (isGuessed) {
                btnClass = isCorrect 
                    ? "bg-emerald-500 border-emerald-700 text-white shadow-emerald-200 opacity-50" 
                    : "bg-slate-200 border-slate-300 text-slate-400 opacity-50";
             }

             return (
               <button
                 key={letter}
                 onClick={() => handleGuess(letter)}
                 disabled={isGuessed || mistakes >= maxLives}
                 className={`w-12 h-16 rounded-2xl font-black text-xl border-b-[6px] active:border-b-0 active:translate-y-1 transition-all ${btnClass}`}
               >
                 {letter}
               </button>
             )
          })}
       </div>
    </div>
  );
};