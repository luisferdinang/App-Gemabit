import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, TaskLog, Quiz, QuizResult, QuizGameItem, QuizType } from '../types';
import { supabaseService, getCurrentWeekId } from '../services/supabaseService';
import { soundService } from '../services/soundService';
import { STUDENT_AVATARS as AVATAR_OPTIONS } from './RoleSelector'; 
import { CheckCircle2, Diamond, Trophy, X, ShoppingBag, QrCode, PlayCircle, PartyPopper, Zap, BookOpen, ShieldCheck, Smile, HeartHandshake, Hand, Sparkles, School, Home, Gamepad2, BrainCircuit, Lock, Coins, Clock, AlertCircle, RefreshCw, ArrowUp, ArrowDown, Scale, GripVertical, Check, Wallet, Send, MessageCircleQuestion, Puzzle, Layers, ListOrdered, Pencil } from 'lucide-react';

interface StudentViewProps {
  student: User;
  refreshUser: () => void;
}

// --- VISUAL HELPERS FOR GAME TYPES ---
const getGameTypeStyles = (type: QuizType) => {
  switch (type) {
    case 'SENTENCE':
      return { 
        label: 'Construir Frase', 
        icon: <Puzzle size={24} />, 
        color: 'bg-orange-500', 
        light: 'bg-orange-50', 
        border: 'border-orange-200',
        text: 'text-orange-600'
      };
    case 'SORTING':
      return { 
        label: 'Clasificar', 
        icon: <Layers size={24} />, 
        color: 'bg-violet-500', 
        light: 'bg-violet-50', 
        border: 'border-violet-200',
        text: 'text-violet-600'
      };
    case 'BALANCE':
      return { 
        label: 'Balanza', 
        icon: <Scale size={24} />, 
        color: 'bg-emerald-500', 
        light: 'bg-emerald-50', 
        border: 'border-emerald-200',
        text: 'text-emerald-600'
      };
    case 'ORDERING':
      return { 
        label: 'Secuencia', 
        icon: <ListOrdered size={24} />, 
        color: 'bg-pink-500', 
        light: 'bg-pink-50', 
        border: 'border-pink-200',
        text: 'text-pink-600'
      };
    case 'TEXT':
    default:
      return { 
        label: 'Pregunta Rápida', 
        icon: <MessageCircleQuestion size={24} />, 
        color: 'bg-sky-500', 
        light: 'bg-sky-50', 
        border: 'border-sky-200',
        text: 'text-sky-600'
      };
  }
};

// --- SUB-COMPONENTS FOR GAMES ---

// 1. Sentence Builder Game
const SentenceGame = ({ quiz, onComplete }: { quiz: Quiz, onComplete: () => void }) => {
  const [availableWords, setAvailableWords] = useState<QuizGameItem[]>([]);
  const [placedWords, setPlacedWords] = useState<(QuizGameItem | null)[]>([]);

  useEffect(() => {
    // Shuffle words for the bank
    if (quiz.gameItems) {
      const shuffled = [...quiz.gameItems].sort(() => Math.random() - 0.5);
      setAvailableWords(shuffled);
      setPlacedWords(new Array(quiz.gameItems.length).fill(null));
    }
  }, [quiz]);

  const handlePlaceWord = (word: QuizGameItem) => {
    const firstEmptyIndex = placedWords.findIndex(w => w === null);
    if (firstEmptyIndex !== -1) {
      const newPlaced = [...placedWords];
      newPlaced[firstEmptyIndex] = word;
      setPlacedWords(newPlaced);
      setAvailableWords(prev => prev.filter(w => w.id !== word.id));
    }
  };

  const handleRemoveWord = (word: QuizGameItem, index: number) => {
    const newPlaced = [...placedWords];
    newPlaced[index] = null;
    setPlacedWords(newPlaced);
    setAvailableWords(prev => [...prev, word]);
  };

  const checkAnswer = () => {
    const currentSentence = placedWords.map(w => w?.text).join(' ');
    const correctSentence = quiz.gameItems?.map(w => w.text).join(' ');
    
    if (currentSentence === correctSentence) {
       onComplete();
    } else {
       alert("Mmm... algo no suena bien. ¡Inténtalo de nuevo!");
       // Reset
       if (quiz.gameItems) {
         setAvailableWords([...quiz.gameItems].sort(() => Math.random() - 0.5));
         setPlacedWords(new Array(quiz.gameItems.length).fill(null));
       }
    }
  };

  return (
    <div className="space-y-6">
       <div className="flex flex-wrap gap-2 min-h-[60px] p-4 bg-slate-100 rounded-2xl border-2 border-slate-200 justify-center items-center">
          {placedWords.map((word, idx) => (
             <button 
               key={idx} 
               onClick={() => word && handleRemoveWord(word, idx)}
               className={`h-12 min-w-[60px] px-3 rounded-xl font-bold text-sm shadow-sm transition-all border-b-4 flex items-center justify-center
                 ${word ? 'bg-white border-slate-300 text-slate-700 animate-pop' : 'bg-slate-200/50 border-slate-300/50 border-dashed'}
               `}
             >
                {word?.text}
             </button>
          ))}
       </div>

       <div className="flex flex-wrap gap-3 justify-center">
          {availableWords.map(word => (
             <button
               key={word.id}
               onClick={() => handlePlaceWord(word)}
               className="bg-sky-500 text-white px-4 py-3 rounded-xl font-black border-b-4 border-sky-700 active:translate-y-1 active:border-b-0 transition-all shadow-lg shadow-sky-200"
             >
               {word.text}
             </button>
          ))}
       </div>
       
       <div className="pt-4">
         <button 
            onClick={checkAnswer}
            disabled={placedWords.some(w => w === null)}
            className="w-full bg-emerald-500 text-white font-black py-4 rounded-2xl border-b-[6px] border-emerald-700 active:translate-y-1 active:border-b-0 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
         >
            ¡Comprobar Frase!
         </button>
       </div>
    </div>
  );
};

// 2. Sorting Game (Need vs Want)
const SortingGame = ({ quiz, onComplete }: { quiz: Quiz, onComplete: () => void }) => {
  const [queue, setQueue] = useState<QuizGameItem[]>([]);
  const [currentItem, setCurrentItem] = useState<QuizGameItem | null>(null);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (quiz.gameItems) {
       setQueue([...quiz.gameItems]);
    }
  }, [quiz]);

  useEffect(() => {
    if (queue.length > 0 && !currentItem) {
       setCurrentItem(queue[0]);
    } else if (queue.length === 0 && !currentItem) {
       onComplete();
    }
  }, [queue, currentItem]);

  const handleSort = (category: 'NEED' | 'WANT') => {
    if (!currentItem) return;

    if (currentItem.category === category) {
       setScore(s => s + 1);
       setQueue(prev => prev.slice(1));
       setCurrentItem(null); 
    } else {
       alert(`¡Ops! ${currentItem.text} es ${currentItem.category === 'NEED' ? 'una Necesidad' : 'un Capricho'}.`);
       setQueue(prev => prev.slice(1));
       setCurrentItem(null); 
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
            className="flex flex-col items-center gap-2 bg-emerald-100 hover:bg-emerald-200 border-4 border-emerald-300 rounded-3xl p-6 transition-colors"
          >
             <div className="p-3 bg-emerald-500 text-white rounded-full"><Check size={32}/></div>
             <span className="font-black text-emerald-800 uppercase tracking-wider">Necesidad</span>
          </button>
          <button 
            onClick={() => handleSort('WANT')}
            className="flex flex-col items-center gap-2 bg-rose-100 hover:bg-rose-200 border-4 border-rose-300 rounded-3xl p-6 transition-colors"
          >
             <div className="p-3 bg-rose-500 text-white rounded-full"><Sparkles size={32}/></div>
             <span className="font-black text-rose-800 uppercase tracking-wider">Capricho</span>
          </button>
       </div>
       <p className="text-center text-slate-400 text-xs font-bold uppercase">Clasifica {queue.length} objetos más</p>
    </div>
  );
};

// 3. Balance Game
const BalanceGame = ({ quiz, onComplete }: { quiz: Quiz, onComplete: () => void }) => {
  const [currentWeight, setCurrentWeight] = useState(0);
  const target = quiz.targetValue || 50;
  
  const coins = [1, 5, 10, 20];

  const addCoin = (val: number) => {
    if (currentWeight + val <= target + 20) {
       setCurrentWeight(prev => prev + val);
    }
  };

  const resetScale = () => setCurrentWeight(0);

  const checkBalance = () => {
    if (currentWeight === target) {
      onComplete();
    } else {
      alert(currentWeight < target ? "Falta dinero..." : "¡Te has pasado! Quita peso.");
      if (currentWeight > target) resetScale();
    }
  };

  return (
     <div className="space-y-6">
        <div className="flex justify-center items-end gap-8 h-32 relative mb-4">
           <div className="flex flex-col items-center gap-2 transition-all duration-500" style={{ transform: `translateY(${currentWeight < target ? '-10px' : currentWeight > target ? '10px' : '0px'})` }}>
              <div className="w-24 h-24 bg-slate-200 rounded-full border-4 border-slate-300 flex items-center justify-center flex-col">
                 <span className="text-2xl font-black text-slate-500">{currentWeight}</span>
                 <span className="text-[10px] font-bold text-slate-400 uppercase">Tus Monedas</span>
              </div>
              <div className="w-0.5 h-10 bg-slate-300"></div>
           </div>

           <div className="flex flex-col items-center gap-2">
              <div className="w-24 h-24 bg-violet-100 rounded-full border-4 border-violet-300 flex items-center justify-center flex-col shadow-lg shadow-violet-200">
                 <span className="text-2xl font-black text-violet-600">{target}</span>
                 <span className="text-[10px] font-bold text-violet-400 uppercase">Precio</span>
              </div>
              <div className="w-0.5 h-10 bg-slate-300"></div>
           </div>

           <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-32 h-2 bg-slate-800 rounded-full"></div>
           <div className="absolute bottom-[-10px] left-1/2 -translate-x-1/2 w-0 h-0 border-l-[20px] border-l-transparent border-r-[20px] border-r-transparent border-b-[40px] border-b-slate-800"></div>
        </div>

        <div className="flex justify-center gap-4">
           {coins.map(val => (
             <button 
               key={val}
               onClick={() => addCoin(val)}
               className="w-16 h-16 rounded-full bg-yellow-400 border-b-4 border-yellow-600 text-yellow-900 font-black text-xl shadow-lg active:scale-95 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center"
             >
               {val}
             </button>
           ))}
        </div>

        <div className="flex gap-4">
           <button onClick={resetScale} className="flex-1 py-3 rounded-xl font-bold text-slate-500 hover:bg-slate-100 transition-colors">
              <RefreshCw className="mx-auto mb-1" size={20}/> Reiniciar
           </button>
           <button 
             onClick={checkBalance}
             className="flex-[2] bg-violet-500 text-white font-black py-3 rounded-xl border-b-4 border-violet-700 active:translate-y-1 active:border-b-0 transition-all"
           >
              ¡Pagar!
           </button>
        </div>
     </div>
  );
};

// 4. Ordering Game (Timeline)
const OrderingGame = ({ quiz, onComplete }: { quiz: Quiz, onComplete: () => void }) => {
  const [items, setItems] = useState<QuizGameItem[]>([]);

  useEffect(() => {
    if (quiz.gameItems) {
       setItems([...quiz.gameItems].sort(() => Math.random() - 0.5));
    }
  }, [quiz]);

  const moveItem = (index: number, direction: 'UP' | 'DOWN') => {
     const newItems = [...items];
     const targetIndex = direction === 'UP' ? index - 1 : index + 1;
     
     if (targetIndex >= 0 && targetIndex < items.length) {
        [newItems[index], newItems[targetIndex]] = [newItems[targetIndex], newItems[index]];
        setItems(newItems);
     }
  };

  const checkOrder = () => {
     const currentIds = items.map(i => i.id).join(',');
     const correctIds = quiz.gameItems ? [...quiz.gameItems].sort((a,b) => a.id.localeCompare(b.id)).map(i => i.id).join(',') : '';

     if (currentIds === correctIds) {
        onComplete();
     } else {
        alert("El orden no es correcto. ¡Piensa qué va primero!");
     }
  };

  return (
    <div className="space-y-4">
       <div className="space-y-2">
          {items.map((item, idx) => (
             <div key={item.id} className="flex items-center gap-2 bg-white p-3 rounded-2xl border-2 border-slate-100 shadow-sm animate-fade-in">
                <div className="bg-slate-100 text-slate-400 font-black w-8 h-8 rounded-full flex items-center justify-center text-sm">
                   {idx + 1}
                </div>
                <span className="flex-1 font-bold text-slate-700">{item.text}</span>
                <div className="flex flex-col gap-1">
                   <button 
                     onClick={() => moveItem(idx, 'UP')}
                     disabled={idx === 0}
                     className="p-1 text-slate-400 hover:text-sky-500 disabled:opacity-30"
                   >
                      <ArrowUp size={20}/>
                   </button>
                   <button 
                     onClick={() => moveItem(idx, 'DOWN')}
                     disabled={idx === items.length - 1}
                     className="p-1 text-slate-400 hover:text-sky-500 disabled:opacity-30"
                   >
                      <ArrowDown size={20}/>
                   </button>
                </div>
             </div>
          ))}
       </div>
       <button 
          onClick={checkOrder}
          className="w-full bg-sky-500 text-white font-black py-4 rounded-2xl border-b-[6px] border-sky-700 active:translate-y-1 active:border-b-0 transition-all mt-4"
       >
          ¡Listo!
       </button>
    </div>
  );
};


// --- HELPERS ---
const getTaskVisuals = (key: string) => {
  const k = key.toUpperCase();
  if (k.includes('ATTENDANCE')) return { icon: <Zap size={32} />, label: 'Asistencia Rayo', color: 'bg-yellow-400 text-yellow-900 border-yellow-600' };
  if (k.includes('RESPONSIBILITY')) return { icon: <ShieldCheck size={32} />, label: 'Super Responsable', color: 'bg-blue-400 text-white border-blue-600' };
  if (k.includes('BEHAVIOR')) return { icon: <Smile size={32} />, label: 'Buen Comportamiento', color: 'bg-purple-400 text-white border-purple-600' };
  if (k.includes('RESPECT')) return { icon: <HeartHandshake size={32} />, label: 'Respeto Total', color: 'bg-pink-400 text-white border-pink-600' };
  if (k.includes('PARTICIPATION')) return { icon: <Hand size={32} />, label: 'Participación', color: 'bg-orange-400 text-white border-orange-600' };
  
  if (k.includes('CHORES')) return { icon: <Sparkles size={32} />, label: 'Ayuda en Casa', color: 'bg-emerald-400 text-white border-emerald-600' };
  if (k.includes('HYGIENE')) return { icon: <Sparkles size={32} />, label: 'Higiene Brillante', color: 'bg-cyan-400 text-white border-cyan-600' };
  if (k.includes('READING') || k.includes('STUDY')) return { icon: <BookOpen size={32} />, label: 'Genio Leyendo', color: 'bg-indigo-400 text-white border-indigo-600' };
  
  return { icon: <Trophy size={32} />, label: key, color: 'bg-slate-400 text-white border-slate-600' };
};

export const StudentView: React.FC<StudentViewProps> = ({ student, refreshUser }) => {
  const [tasks, setTasks] = useState<TaskLog[]>([]);
  
  // Quiz Arcade State
  const [showArcade, setShowArcade] = useState(false);
  const [availableQuizzes, setAvailableQuizzes] = useState<Quiz[]>([]);
  const [completedQuizzes, setCompletedQuizzes] = useState<QuizResult[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  
  // Arcade Bag State
  const [sessionEarnings, setSessionEarnings] = useState(0);

  // Avatar Modal State
  const [showAvatarModal, setShowAvatarModal] = useState(false);

  // Celebration State
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{count: number, items: string[]}>({ count: 0, items: [] });
  const hasCheckedCelebration = useRef(false);

  useEffect(() => {
    loadTasks();
    
    // Realtime Subscriptions
    const tasksSub = supabaseService.subscribeToChanges('tasks', `student_id=eq.${student.uid}`, () => {
        loadTasks();
    });
    const profileSub = supabaseService.subscribeToChanges('profiles', `id=eq.${student.uid}`, () => {
        refreshUser();
    });

    return () => {
        tasksSub.unsubscribe();
        profileSub.unsubscribe();
    };
  }, [student.uid]);

  const loadTasks = async () => {
    const data = await supabaseService.getTasks(student.uid);
    setTasks(data);
    checkForCelebration(data);
  };

  const loadQuizData = async () => {
    const data = await supabaseService.getStudentQuizzes(student.uid);
    setAvailableQuizzes(data.available);
    setCompletedQuizzes(data.completed);
  };

  const openArcade = () => {
      loadQuizData();
      setShowArcade(true);
  };

  const checkForCelebration = (loadedTasks: TaskLog[]) => {
    if (hasCheckedCelebration.current) return;
    
    let totalEarnings = 0;
    let approvedItems: string[] = [];

    // Calculate total earned from approved/completed tasks this week
    loadedTasks.forEach(task => {
        Object.entries(task.status).forEach(([key, completed]) => {
            if (completed) {
                const reward = task.type === 'SCHOOL' ? 20 : 25;
                totalEarnings += reward;
                if (approvedItems.length < 3) {
                   const visuals = getTaskVisuals(key);
                   approvedItems.push(visuals.label);
                }
            }
        });
    });

    if (totalEarnings > 0) {
        const weekId = getCurrentWeekId();
        const storageKey = `gemabit_celebration_${student.uid}_${weekId}_${totalEarnings}`;
        
        if (localStorage.getItem(storageKey)) {
            hasCheckedCelebration.current = true;
            return;
        }

        soundService.playCelebration(); 
        setCelebrationData({ 
            count: totalEarnings, 
            items: approvedItems.length < 3 ? approvedItems : [...approvedItems, '...y más!'] 
        });
        setShowCelebration(true);
        localStorage.setItem(storageKey, 'true');
    }
    hasCheckedCelebration.current = true;
  };

  const handleQuizSuccess = async () => {
    if (!activeQuiz) return;
    
    const earned = activeQuiz.reward;
    soundService.playCoin(); 

    // AUTO-SAVE TO DB (PENDING APPROVAL)
    let description = activeQuiz.question;
    if (activeQuiz.type !== 'TEXT') {
        description = `Juego: ${activeQuiz.type} completado`;
    }
    await supabaseService.submitQuiz(student.uid, activeQuiz.id, description, 1, earned);
    
    // UI Feedback
    setSessionEarnings(prev => prev + earned);
    alert(`¡Genial! 🎒 Has ganado ${earned} MiniBits. La maestra ya ha recibido tu resultado.`);
    
    // Close game and reload list
    setActiveQuiz(null); 
    loadQuizData(); 
  };
  
  const handleChangeAvatar = async (newUrl: string) => {
    const success = await supabaseService.updateAvatar(student.uid, newUrl);
    if (success) {
        refreshUser();
        setShowAvatarModal(false);
    }
  };

  const handleTextAnswer = (index: number) => {
    if (!activeQuiz) return;
    if (index === activeQuiz.correctIndex) {
        handleQuizSuccess();
    } else {
        alert("¡Casi! 😅 Inténtalo de nuevo.");
    }
  };

  const gems = Math.floor(student.balance / 100);
  const minibits = student.balance % 100;
  const streakPercent = Math.min((student.streakWeeks / 4) * 100, 100);

  // Memoized Derived State
  const { totalQuizEarnings, pendingQuizEarnings } = useMemo(() => {
      const total = completedQuizzes
        .filter(q => q.status === 'APPROVED')
        .reduce((sum, q) => sum + q.earned, 0);
      const pending = completedQuizzes
        .filter(q => q.status === 'PENDING')
        .reduce((sum, q) => sum + q.earned, 0);
      return { totalQuizEarnings: total, pendingQuizEarnings: pending };
  }, [completedQuizzes]);

  const weeklyProgress = useMemo(() => {
      let totalTasks = 0;
      let completedTasks = 0;
      tasks.forEach(t => {
          totalTasks += Object.keys(t.status).length;
          completedTasks += Object.values(t.status).filter(Boolean).length;
      });
      return totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;
  }, [tasks]);

  const renderActiveGame = () => {
      if (!activeQuiz) return null;
      switch (activeQuiz.type) {
          case 'SENTENCE':
              return <SentenceGame quiz={activeQuiz} onComplete={handleQuizSuccess} />;
          case 'SORTING':
              return <SortingGame quiz={activeQuiz} onComplete={handleQuizSuccess} />;
          case 'BALANCE':
              return <BalanceGame quiz={activeQuiz} onComplete={handleQuizSuccess} />;
          case 'ORDERING':
              return <OrderingGame quiz={activeQuiz} onComplete={handleQuizSuccess} />;
          case 'TEXT':
          default:
              return (
                  <div className="space-y-3 mb-6">
                      {activeQuiz.options?.map((opt, idx) => (
                          <button 
                              key={idx}
                              onClick={() => handleTextAnswer(idx)}
                              className="w-full text-left p-4 rounded-2xl border-4 border-slate-100 font-bold text-slate-600 hover:border-violet-500 hover:bg-violet-50 hover:text-violet-700 transition-all active:scale-95 text-lg"
                          >
                              {opt}
                          </button>
                      ))}
                  </div>
              );
      }
  };

  return (
    <div className="space-y-8 animate-fade-in">
      
      <div className="flex items-center gap-4 bg-white p-4 rounded-3xl border-b-4 border-slate-200 shadow-sm relative overflow-hidden">
         <div className="relative group">
            <div className="w-20 h-20 rounded-2xl bg-violet-50 border-4 border-violet-200 overflow-hidden shrink-0 relative z-10 animate-float cursor-pointer" onClick={() => setShowAvatarModal(true)}>
                <img src={student.avatar} alt="Mi Avatar" className="w-full h-full object-cover" loading="eager" />
            </div>
            <button 
                onClick={() => setShowAvatarModal(true)}
                className="absolute -bottom-2 -right-2 bg-white text-slate-500 p-1.5 rounded-full border-2 border-slate-200 shadow-sm z-20 hover:scale-110 transition-transform"
            >
                <Pencil size={14} />
            </button>
         </div>
         <div className="relative z-10">
            <h2 className="text-2xl font-black text-slate-700">¡Hola, {student.displayName.split(' ')[0]}!</h2>
            <p className="text-slate-400 font-bold text-sm">¡Vamos a llenar la barra de energía!</p>
         </div>
         <div className="absolute right-0 top-0 w-32 h-32 bg-yellow-100 rounded-full blur-2xl opacity-60 translate-x-10 -translate-y-10"></div>
      </div>

      {student.linkCode && (
        <div className="bg-gradient-to-r from-orange-400 to-amber-500 rounded-3xl p-5 text-white shadow-lg flex items-center justify-between relative overflow-hidden group hover:scale-[1.02] transition-transform">
           <div className="relative z-10">
              <p className="font-bold text-orange-100 text-xs uppercase tracking-wider mb-1">Código de Vinculación</p>
              <div className="bg-white/20 px-4 py-2 rounded-xl inline-block backdrop-blur-sm border-2 border-white/30">
                <p className="font-black text-3xl tracking-widest font-mono shadow-sm">{student.linkCode}</p>
              </div>
              <p className="text-xs font-bold text-orange-50 mt-2">Dáselo a tus papás</p>
           </div>
           <QrCode size={60} className="text-white/30 rotate-12 group-hover:rotate-0 transition-transform duration-500" />
           <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-emerald-500 rounded-[2rem] p-5 text-white border-b-[6px] border-emerald-700 relative overflow-hidden shadow-emerald-200 shadow-xl active:translate-y-1 active:border-b-0 transition-all">
          <div className="relative z-10">
            <h3 className="font-bold text-emerald-100 uppercase text-[10px] tracking-wider mb-1">Mi Billetera</h3>
            <div className="flex items-baseline gap-1">
              <img src="https://i.ibb.co/kVhqQ0K9/gemabit.png" className="w-8 h-8 object-contain mr-1" />
              <span className="text-4xl font-black drop-shadow-md">{gems}</span>
              <span className="text-sm font-bold opacity-90">GemaBits</span>
            </div>
            <div className="flex items-center gap-2 mt-2 bg-emerald-700/40 w-fit px-3 py-1 rounded-full backdrop-blur-md border border-emerald-400/30">
              <img src="https://i.ibb.co/JWvYtPhJ/minibit-1.png" className="w-4 h-4 object-contain" />
              <span className="font-bold text-xs">{minibits} MB</span>
            </div>
          </div>
          <Diamond className="absolute -right-4 -bottom-4 text-emerald-300/40 rotate-12" size={100} />
        </div>

        <div className="bg-violet-500 rounded-[2rem] p-5 text-white border-b-[6px] border-violet-700 relative overflow-hidden shadow-violet-200 shadow-xl active:translate-y-1 active:border-b-0 transition-all">
           <div className="relative z-10">
            <h3 className="font-bold text-violet-200 uppercase text-[10px] tracking-wider mb-1">Gana 1 Super GemaBit</h3>
            <div className="flex items-end gap-1 mb-2">
               <span className="text-3xl font-black drop-shadow-md">{student.streakWeeks}</span>
               <span className="text-xs font-bold mb-1 opacity-80">/ 4 Semanas</span>
            </div>
            <div className="w-full bg-violet-900/40 h-4 rounded-full overflow-hidden border border-violet-400/30 relative">
               <div className="absolute inset-0 bg-repeat-x opacity-20" style={{backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem'}}></div>
              <div className="bg-gradient-to-r from-yellow-300 to-yellow-500 h-full rounded-full shadow-sm" style={{ width: `${streakPercent}%` }}></div>
            </div>
          </div>
          <img src="https://i.ibb.co/Y9DqFjM/supergemabit.png" className="absolute -right-2 -bottom-2 w-24 h-24 object-contain opacity-40 rotate-12" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
          <button 
             onClick={openArcade}
             className="bg-sky-500 hover:bg-sky-400 active:translate-y-1 active:border-b-0 text-white rounded-[2rem] p-4 border-b-[6px] border-sky-700 flex flex-col items-center justify-center gap-1 font-black transition-all shadow-lg shadow-sky-200 h-28 relative overflow-hidden group"
          >
             <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
             <>
                <div className="bg-white/20 p-2.5 rounded-full mb-1 group-hover:scale-110 transition-transform relative">
                  <Gamepad2 size={28} strokeWidth={3} />
                  {pendingQuizEarnings > 0 && (
                     <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                  )}
                </div>
                <span className="text-base tracking-tight leading-none flex items-center gap-1">
                    Zona Arcade 
                    <img src="https://i.ibb.co/JWvYtPhJ/minibit-1.png" className="w-4 h-4 object-contain inline" />
                </span>
             </>
          </button>
          
          <button className="bg-rose-400 hover:bg-rose-300 active:translate-y-1 active:border-b-0 text-white rounded-[2rem] p-4 border-b-[6px] border-rose-600 flex flex-col items-center justify-center gap-1 font-black transition-all shadow-lg shadow-rose-200 h-28 group relative overflow-hidden">
             <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
             <div className="bg-white/20 p-2.5 rounded-full mb-1 group-hover:scale-110 transition-transform">
               <ShoppingBag size={28} strokeWidth={3} />
             </div>
             <span className="text-base tracking-tight leading-none">Tienda</span>
          </button>
      </div>

      <div className="space-y-6">
        <div className="bg-slate-800 rounded-[2rem] p-6 text-white relative overflow-hidden shadow-lg border-b-4 border-slate-950">
           <div className="relative z-10 flex justify-between items-end mb-2">
              <div>
                <h3 className="font-black text-xl flex items-center gap-2">
                    <Trophy className="text-yellow-400 fill-yellow-400 animate-bounce-slow" />
                    Misiones Semanales
                </h3>
                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">Completa todo para el Super GemaBit</p>
              </div>
              <span className="font-black text-3xl text-emerald-400">{Math.round(weeklyProgress)}%</span>
           </div>
           <div className="h-6 bg-slate-700 rounded-full border-2 border-slate-600 overflow-hidden relative">
               <div 
                 className="h-full bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-500 transition-all duration-1000 ease-out relative" 
                 style={{width: `${weeklyProgress}%`}}
               >
                 <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
               </div>
           </div>
        </div>
        
        {tasks.length === 0 ? (
           <p className="text-slate-400 font-bold text-center py-8">Cargando misiones...</p>
        ) : (
          <div className="grid gap-8">
            {tasks.map((task) => {
              const isSchool = task.type === 'SCHOOL';
              return (
                <div key={task.id} className="relative">
                   <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20">
                      <div className={`
                        px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest shadow-lg border-b-4 flex items-center gap-2
                        ${isSchool ? 'bg-violet-500 border-violet-700 text-white' : 'bg-emerald-500 border-emerald-700 text-white'}
                      `}>
                        {isSchool ? <School size={16}/> : <Home size={16}/>}
                        {isSchool ? 'Misiones de Escuela' : 'Misiones del Hogar'}
                      </div>
                   </div>

                   <div className={`
                      grid grid-cols-2 gap-3 pt-8 pb-6 px-4 rounded-[2.5rem] border-4 border-dashed
                      ${isSchool ? 'bg-violet-50/50 border-violet-200' : 'bg-emerald-50/50 border-emerald-200'}
                   `}>
                      {Object.entries(task.status).map(([key, completed]) => {
                          const visual = getTaskVisuals(key);
                          return (
                            <div key={key} className={`
                                relative aspect-square rounded-3xl p-3 flex flex-col items-center justify-center text-center transition-all duration-300 group
                                ${completed 
                                  ? `${visual.color} shadow-lg scale-100 border-b-[6px]` 
                                  : 'bg-white border-2 border-slate-200 text-slate-300 shadow-sm scale-95'
                                }
                            `}>
                               <div className={`
                                  mb-2 p-2 rounded-2xl transition-transform duration-500
                                  ${completed 
                                    ? 'bg-white/20 rotate-0 scale-110 shadow-inner' 
                                    : 'bg-slate-100 grayscale opacity-50 group-hover:scale-110'
                                  }
                               `}>
                                  {visual.icon}
                               </div>

                               <span className={`
                                  text-[10px] sm:text-xs font-black uppercase leading-tight
                                  ${completed ? 'opacity-100' : 'opacity-60'}
                               `}>
                                  {visual.label}
                               </span>

                               {completed && (
                                  <div className="absolute -top-2 -right-2 bg-white text-emerald-600 rounded-full p-1 border-2 border-emerald-100 shadow-sm animate-bounce-slow">
                                      <CheckCircle2 size={16} strokeWidth={4} />
                                  </div>
                               )}
                               
                               {completed && (
                                  <div className="absolute -bottom-3 bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-0.5 rounded-full border-b-2 border-yellow-600 shadow-sm flex items-center gap-1">
                                    +{isSchool ? 20 : 25} <img src="https://i.ibb.co/JWvYtPhJ/minibit-1.png" className="w-3 h-3 object-contain"/>
                                  </div>
                               )}
                            </div>
                          );
                      })}
                   </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showArcade && (
         <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/95 backdrop-blur-md animate-fade-in text-white p-4 overflow-y-auto">
             <div className="flex justify-between items-center mb-6 sticky top-0 bg-slate-900/80 p-2 z-20 backdrop-blur-xl rounded-2xl border border-white/10">
                 <div className="flex items-center gap-3">
                    <div className="bg-sky-500 p-2 rounded-xl text-white">
                        <Gamepad2 size={24} />
                    </div>
                    <div>
                        <h2 className="text-xl font-black">Zona Arcade</h2>
                        <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
                           <span className="flex items-center gap-1"><img src="https://i.ibb.co/JWvYtPhJ/minibit-1.png" className="w-4 h-4" /> {minibits} MB</span>
                        </div>
                    </div>
                 </div>
                 <button onClick={() => { setShowArcade(false); setActiveQuiz(null); }} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
                     <X size={24} />
                 </button>
             </div>

             <div className="mb-8">
                 <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-3xl p-6 border-4 border-amber-300 shadow-xl relative overflow-hidden">
                     <div className="relative z-10 flex justify-between items-center">
                         <div>
                            <p className="text-amber-100 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-2">
                               <Wallet size={16}/> Bolsa Actual
                            </p>
                            <span className="text-4xl font-black text-white flex items-center gap-2 drop-shadow-md">
                                {sessionEarnings} <span className="text-lg opacity-80">MB</span>
                            </span>
                         </div>
                         
                         <div className="px-6 py-4 rounded-2xl font-black text-sm uppercase tracking-wider flex items-center gap-2 bg-white/10 border border-white/20 text-white backdrop-blur-sm">
                             <CheckCircle2 size={18} />
                             Guardado Auto
                         </div>
                     </div>
                     <Coins className="absolute -right-6 -bottom-6 text-white/20" size={100} />
                 </div>
             </div>

             {!activeQuiz ? (
                 <div className="space-y-8 pb-12">
                     <div className="space-y-4">
                         <h3 className="text-lg font-black flex items-center gap-2 text-sky-400">
                             <PlayCircle size={20} /> Disponibles
                         </h3>
                         {availableQuizzes.length === 0 ? (
                             <div className="bg-white/5 rounded-3xl p-8 text-center border-2 border-dashed border-white/10">
                                 <div className="inline-block p-4 bg-white/5 rounded-full mb-3">
                                     {completedQuizzes.length > 0 ? <CheckCircle2 className="text-emerald-400" size={32} /> : <PlayCircle className="text-slate-500" size={32} />}
                                 </div>
                                 <p className="font-bold text-slate-400">
                                     ¡Todo completado!
                                 </p>
                                 <p className="text-xs text-slate-500">
                                     Vuelve más tarde para nuevos desafíos.
                                 </p>
                             </div>
                         ) : (
                             availableQuizzes.map(quiz => {
                                 const visuals = getGameTypeStyles(quiz.type);
                                 return (
                                     <button 
                                         key={quiz.id}
                                         onClick={() => setActiveQuiz(quiz)}
                                         className="w-full text-left bg-white rounded-3xl p-5 relative overflow-hidden group hover:scale-[1.02] transition-transform shadow-lg flex gap-4 items-center"
                                     >
                                         <div className={`w-16 h-16 rounded-2xl ${visuals.light} ${visuals.text} flex items-center justify-center shrink-0 border-2 ${visuals.border}`}>
                                             {visuals.icon}
                                         </div>
                                         <div className="relative z-10 flex-1">
                                             <div className="flex justify-between items-start mb-1">
                                                 <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${visuals.light} ${visuals.text} border ${visuals.border}`}>
                                                     {visuals.label}
                                                 </span>
                                                 <div className="flex items-center gap-1 bg-yellow-400 text-yellow-900 px-2 py-1 rounded-lg font-black text-xs shadow-sm">
                                                     <div className="w-2 h-2 rounded-full bg-yellow-900/50"></div>
                                                     +{quiz.reward} MB
                                                 </div>
                                             </div>
                                             <h4 className="text-slate-800 font-black text-base leading-tight pr-2 line-clamp-2">{quiz.question}</h4>
                                         </div>
                                         <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-slate-100 to-transparent opacity-50"></div>
                                     </button>
                                 );
                             })
                         )}
                     </div>
                     
                     {completedQuizzes.length > 0 && (
                         <div className="space-y-4">
                             <div className="flex items-center justify-between">
                                 <h3 className="text-lg font-black flex items-center gap-2 text-emerald-400">
                                     <CheckCircle2 size={20} /> Misiones Logradas
                                 </h3>
                                 <span className="text-xs font-bold text-slate-500 bg-white/10 px-2 py-1 rounded-lg">
                                     Total: +{totalQuizEarnings} MB
                                 </span>
                             </div>

                             <div className="space-y-3">
                                 {completedQuizzes.map((result, idx) => {
                                      const isPending = result.status === 'PENDING';
                                      return (
                                         <div key={idx} className="bg-slate-800/50 rounded-2xl p-4 flex items-center justify-between border border-white/5">
                                             <div className="flex items-center gap-4">
                                                 <div className={`p-3 rounded-xl ${isPending ? 'bg-amber-500/20 text-amber-400' : 'bg-emerald-500/20 text-emerald-400'}`}>
                                                     {isPending ? <Clock size={20} /> : <CheckCircle2 size={20} />}
                                                 </div>
                                                 <div>
                                                     <p className="font-bold text-slate-200 text-sm line-clamp-1">{result.questionPreview}</p>
                                                     <div className="flex items-center gap-2 mt-1">
                                                         <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isPending ? 'bg-amber-500/10 text-amber-300' : 'bg-emerald-500/10 text-emerald-300'}`}>
                                                             {isPending ? 'Esperando Aprobación' : 'Aprobado'}
                                                         </span>
                                                     </div>
                                                 </div>
                                             </div>
                                             <div className="font-black text-white whitespace-nowrap flex items-center gap-1">
                                                 <img src="https://i.ibb.co/JWvYtPhJ/minibit-1.png" className="w-4 h-4 object-contain" />
                                                 +{result.earned} MB
                                             </div>
                                         </div>
                                      );
                                 })}
                             </div>
                         </div>
                     )}
                 </div>
             ) : (
                 <div className="flex flex-col h-full justify-center max-w-md mx-auto w-full">
                     <div className="bg-white rounded-[2.5rem] p-8 text-slate-800 shadow-2xl relative overflow-hidden animate-bounce-slow">
                          <button onClick={() => setActiveQuiz(null)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 z-50">
                              <X size={20} />
                          </button>
                          
                          <div className="text-center mb-6">
                              {(() => {
                                const visuals = getGameTypeStyles(activeQuiz.type);
                                return (
                                  <>
                                    <div className={`inline-flex items-center gap-2 ${visuals.light} ${visuals.text} px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border-2 ${visuals.border}`}>
                                        {visuals.icon}
                                        {visuals.label}
                                    </div>
                                  </>
                                )
                              })()}
                              <h3 className="text-2xl font-black mt-4 leading-tight">{activeQuiz.question}</h3>
                          </div>

                          {renderActiveGame()}

                          <div className="flex justify-center mt-6">
                              <div className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-xl font-black text-sm flex items-center gap-2">
                                  <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div>
                                  Premio: {activeQuiz.reward} MB
                              </div>
                          </div>
                     </div>
                 </div>
             )}
         </div>
      )}

      {showAvatarModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in">
             <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border-4 border-white">
                 <div className="text-center mb-6">
                     <h3 className="text-xl font-black text-slate-800">Elige tu Mascota</h3>
                     <p className="text-xs font-bold text-slate-400 uppercase mt-1">¿Quién eres hoy?</p>
                 </div>
                 
                 <div className="grid grid-cols-4 gap-3 mb-6">
                    {AVATAR_OPTIONS.map(opt => (
                        <button 
                           key={opt.url}
                           onClick={() => handleChangeAvatar(opt.url)}
                           className={`rounded-2xl border-4 transition-all relative overflow-hidden aspect-square hover:scale-105 active:scale-95 ${
                               student.avatar === opt.url 
                               ? 'border-violet-500 shadow-lg scale-110 bg-violet-50 z-10' 
                               : 'border-slate-100 hover:border-violet-200'
                           }`}
                        >
                            <img src={opt.url} className="w-full h-full object-cover" alt={opt.name} />
                        </button>
                    ))}
                 </div>
                 
                 <button 
                    onClick={() => setShowAvatarModal(false)}
                    className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-black rounded-2xl transition-colors"
                 >
                    Cancelar
                 </button>
             </div>
        </div>
      )}

      {showCelebration && (
         <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-fade-in">
             <div className="absolute inset-0 overflow-hidden pointer-events-none">
                 <div className="absolute top-1/4 left-1/4 w-3 h-3 bg-yellow-400 rounded-full animate-ping"></div>
                 <div className="absolute top-1/3 right-1/4 w-4 h-4 bg-emerald-400 rounded-full animate-bounce"></div>
                 <div className="absolute bottom-1/3 left-1/3 w-2 h-2 bg-rose-400 rounded-full animate-ping delay-75"></div>
                 <div className="absolute top-10 right-10 w-6 h-6 bg-violet-400 rotate-45 animate-pulse"></div>
             </div>

             <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 text-center relative overflow-hidden shadow-2xl border-4 border-white animate-bounce-slow">
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-emerald-100 to-yellow-100 rounded-full blur-3xl opacity-50 animate-spin-slow pointer-events-none"></div>

                 <div className="relative z-10">
                    <div className="inline-block p-4 bg-yellow-100 text-yellow-500 rounded-full mb-4 shadow-sm animate-bounce">
                        <PartyPopper size={48} strokeWidth={3} />
                    </div>
                    
                    <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">¡Misión Cumplida!</h2>
                    <p className="text-slate-500 font-bold mb-6 text-sm">Tus padres y maestra aprobaron:</p>

                    <div className="flex flex-wrap gap-2 justify-center mb-6">
                        {celebrationData.items.map((item, i) => (
                            <span key={i} className="bg-slate-100 border-2 border-slate-200 px-3 py-1 rounded-xl text-xs font-black text-slate-600 capitalize">
                                {item}
                            </span>
                        ))}
                    </div>

                    <div className="bg-slate-900 text-white rounded-3xl p-6 mb-6 shadow-xl relative overflow-hidden group">
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-emerald-600 opacity-20 group-hover:opacity-30 transition-opacity"></div>
                        <p className="text-emerald-300 text-xs font-black uppercase tracking-widest mb-1">Has Ganado</p>
                        <div className="flex items-center justify-center gap-2">
                             <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-500 drop-shadow-sm">
                                +{celebrationData.count}
                             </span>
                             <span className="text-xl font-bold">MB</span>
                        </div>
                        {celebrationData.count >= 100 && (
                            <div className="mt-2 bg-white/10 rounded-lg py-1 px-3 inline-flex items-center gap-2">
                                <img src="https://i.ibb.co/kVhqQ0K9/gemabit.png" className="w-4 h-4 object-contain animate-pulse" />
                                <span className="text-xs font-bold text-white">¡Eso es +{Math.floor(celebrationData.count/100)} GemaBit!</span>
                            </div>
                        )}
                    </div>

                    <button 
                       onClick={() => setShowCelebration(false)}
                       className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-black py-4 rounded-2xl border-b-[6px] border-emerald-700 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-widest text-lg shadow-lg shadow-emerald-200"
                    >
                       ¡Recoger Premio!
                    </button>
                 </div>
             </div>
         </div>
      )}
    </div>
  );
};