import React, { useState, useEffect, useMemo } from 'react';
import { Quiz } from '../../types';
import { Heart, RefreshCw, HelpCircle } from 'lucide-react';
import { soundService } from '../../services/soundService';

export const SecretWordGame = ({ quiz, onComplete }: { quiz: Quiz, onComplete: () => void }) => {
  // ESTRATEGIA DE RESPALDO: Busca la respuesta en 'answer' (si existe columna) o en 'options[0]' (parche)
  // Si no hay nada, usa "ERROR" para que se vea algo en pantalla y no rompa
  const originalWord = (quiz.answer || (quiz.options && quiz.options[0]) || '').trim().toUpperCase();
  
  const normalizeChar = (char: string) => {
      return char
        .replace(/[ÁÀÄÂ]/g, 'A')
        .replace(/[ÉÈËÊ]/g, 'E')
        .replace(/[ÍÌÏÎ]/g, 'I')
        .replace(/[ÓÒÖÔ]/g, 'O')
        .replace(/[ÚÙÜÛ]/g, 'U');
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

    if (!normalizedSecret.includes(letter)) {
      setMistakes(prev => prev + 1);
      soundService.playPop(); 
    } else {
      soundService.playCoin();
    }
  };

  useEffect(() => {
    if (!normalizedSecret) return;
    
    // Verificar victoria ignorando espacios
    const isWin = normalizedSecret.split('').every(char => {
        if (!"ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".includes(char)) return true; 
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

  // Si la palabra está vacía por error de base de datos
  if (!originalWord) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-red-50 rounded-[2.5rem] border-4 border-red-200 border-dashed text-center">
        <div className="bg-white p-4 rounded-full mb-3 shadow-sm text-red-300">
            <HelpCircle size={32} />
        </div>
        <p className="text-red-500 font-bold mb-1">Error de Datos</p>
        <p className="text-xs text-red-400 max-w-xs mx-auto font-bold">
            No se encontró la palabra secreta. Por favor, pide a la maestra que borre este juego y lo cree de nuevo.
        </p>
      </div>
    );
  }

  const alphabet = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split('');

  return (
    <div className="space-y-8 select-none">
       {/* Vidas / Corazones */}
       <div className="flex justify-center gap-2 mb-4 bg-pink-50 p-2 rounded-2xl w-fit mx-auto border-2 border-pink-100">
          {[...Array(maxLives)].map((_, i) => (
             <Heart 
               key={i} 
               size={24} 
               className={`${i < (maxLives - mistakes) ? 'text-pink-500 fill-pink-500 animate-pulse' : 'text-slate-200 fill-slate-200'}`} 
             />
          ))}
       </div>

       {/* ÁREA DE JUEGO (PALABRA) */}
       <div className="flex flex-wrap justify-center items-end gap-3 min-h-[80px] px-2 py-4">
          {originalWord.split('').map((originalChar, index) => {
             const normChar = normalizeChar(originalChar);
             const isSpace = originalChar === ' ';
             // Mostrar si ya se adivinó o si es un símbolo raro
             const isGuessed = guessedLetters.has(normChar);
             const isVisible = isGuessed || isSpace;

             if (isSpace) {
                 // Espacio entre palabras
                 return <div key={index} className="w-8 h-16 flex items-center justify-center"></div>;
             }

             return (
               <div key={index} className="flex flex-col items-center gap-1">
                   {/* Contenedor de la Letra y la Rayita */}
                   <div className="w-10 sm:w-12 h-16 flex flex-col justify-end items-center">
                       {/* La Letra */}
                       <span className={`font-black text-3xl sm:text-4xl text-slate-800 mb-1 transition-all duration-300 transform ${isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-4 scale-50'}`}>
                            {originalChar}
                       </span>
                       
                       {/* LA RAYITA (Línea inferior gruesa) */}
                       <div className="w-full h-1.5 bg-slate-800 rounded-full"></div>
                   </div>
               </div>
             )
          })}
       </div>

       {/* TECLADO */}
       <div className="flex flex-wrap gap-1.5 sm:gap-2 justify-center max-w-lg mx-auto pt-4 pb-2">
          {alphabet.map(letter => {
             const isGuessed = guessedLetters.has(letter);
             const isCorrect = normalizedSecret.includes(letter);
             
             let btnClass = "bg-white border-b-[5px] border-slate-200 text-slate-500 hover:bg-slate-50";
             
             if (isGuessed) {
                if (isCorrect) {
                    btnClass = "bg-emerald-500 border-b-[0px] border-emerald-700 text-white opacity-50 translate-y-[5px] shadow-none";
                } else {
                    btnClass = "bg-slate-200 border-b-[0px] border-slate-300 text-slate-300 opacity-50 translate-y-[5px] shadow-none";
                }
             } else {
                 // Estado normal (no pulsado)
                 btnClass += " active:border-b-0 active:translate-y-[5px] transition-all shadow-sm";
             }

             return (
               <button
                 key={letter}
                 onClick={() => handleGuess(letter)}
                 disabled={isGuessed || mistakes >= maxLives}
                 className={`w-9 h-12 sm:w-11 sm:h-14 rounded-xl font-black text-lg sm:text-xl flex items-center justify-center ${btnClass}`}
               >
                 {letter}
               </button>
             )
          })}
       </div>
    </div>
  );
};