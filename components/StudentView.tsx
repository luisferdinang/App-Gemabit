import React, { useState, useEffect, useMemo } from 'react';
import { User, Transaction, Quiz, QuizResult } from '../types';
import { supabaseService, getCurrentWeekId } from '../services/supabaseService';
import { TaskController } from './TaskController';
import { 
  X, TrendingUp, ArrowUpCircle, ArrowDownCircle, History, Calendar, Plus, 
  ShoppingBag, PiggyBank, Wallet, CheckCircle2, Gamepad2, Trophy, Star, 
  Sparkles, RefreshCw, AlertCircle, Check 
} from 'lucide-react';
import { soundService } from '../services/soundService';

interface StudentViewProps {
  student: User;
  refreshUser: () => void;
}

export const StudentView: React.FC<StudentViewProps> = ({ student, refreshUser }) => {
  const [activeTab, setActiveTab] = useState<'TASKS' | 'ARCADE'>('TASKS');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showFinanceModal, setShowFinanceModal] = useState(false);
  const [financeTimeframe, setFinanceTimeframe] = useState<'DAY' | 'WEEK' | 'MONTH' | 'ALL'>('WEEK');
  
  // Arcade State
  const [availableQuizzes, setAvailableQuizzes] = useState<Quiz[]>([]);
  const [completedQuizzes, setCompletedQuizzes] = useState<QuizResult[]>([]);
  const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
  
  // Quiz Play State
  const [quizAnswer, setQuizAnswer] = useState<any>(null); // Index or String or Array
  const [quizFeedback, setQuizFeedback] = useState<'CORRECT' | 'WRONG' | null>(null);

  useEffect(() => {
    loadData();
    // Subscribe to changes
    const subTransactions = supabaseService.subscribeToChanges('transactions', `student_id=eq.${student.uid}`, () => {
        loadData();
        refreshUser();
    });
    
    // Subscribe to new quizzes
    const subQuizzes = supabaseService.subscribeToChanges('quizzes', undefined, () => {
        loadArcade();
    });

    const subQuizResults = supabaseService.subscribeToChanges('quiz_results', `student_id=eq.${student.uid}`, () => {
        loadArcade();
        refreshUser();
    });

    return () => {
        subTransactions.unsubscribe();
        subQuizzes.unsubscribe();
        subQuizResults.unsubscribe();
    };
  }, [student.uid]);

  useEffect(() => {
      if (activeTab === 'ARCADE') {
          loadArcade();
      }
  }, [activeTab]);

  const loadData = async () => {
    const txs = await supabaseService.getTransactions(student.uid);
    setTransactions(txs);
  };

  const loadArcade = async () => {
      const { available, completed } = await supabaseService.getStudentQuizzes(student.uid);
      setAvailableQuizzes(available);
      setCompletedQuizzes(completed);
  };

  const filteredTransactions = useMemo(() => {
      const now = Date.now();
      const oneDay = 24 * 60 * 60 * 1000;
      return transactions.filter(t => {
          if (financeTimeframe === 'ALL') return true;
          if (financeTimeframe === 'DAY') return (now - t.timestamp) < oneDay;
          if (financeTimeframe === 'WEEK') return (now - t.timestamp) < (oneDay * 7);
          if (financeTimeframe === 'MONTH') return (now - t.timestamp) < (oneDay * 30);
          return true;
      });
  }, [transactions, financeTimeframe]);

  const totalEarned = useMemo(() => filteredTransactions.filter(t => t.type === 'EARN').reduce((acc, t) => acc + t.amount, 0), [filteredTransactions]);
  const totalSpent = useMemo(() => filteredTransactions.filter(t => t.type === 'SPEND').reduce((acc, t) => acc + Math.abs(t.amount), 0), [filteredTransactions]);

  // --- QUIZ LOGIC ---
  const handleStartQuiz = (quiz: Quiz) => {
      setActiveQuiz(quiz);
      setQuizAnswer(null);
      setQuizFeedback(null);
      
      // Initialize answer state based on type
      if (quiz.type === 'SENTENCE') setQuizAnswer([]);
      if (quiz.type === 'SORTING') setQuizAnswer({}); // Map itemId -> category
      if (quiz.type === 'SECRET_WORD') setQuizAnswer('');
  };

  const handleCheckQuiz = async () => {
      if (!activeQuiz) return;
      
      let isCorrect = false;

      if (activeQuiz.type === 'TEXT' || activeQuiz.type === 'INTRUDER') {
          isCorrect = quizAnswer === activeQuiz.correctIndex;
      } else if (activeQuiz.type === 'SECRET_WORD') {
          isCorrect = quizAnswer?.trim().toUpperCase() === activeQuiz.answer?.trim().toUpperCase();
      } else if (activeQuiz.type === 'SENTENCE') {
          // Compare constructed sentence with gameItems order
          const correctOrder = activeQuiz.gameItems?.map(i => i.text).join(' ');
          const userOrder = (quizAnswer as string[]).join(' ');
          isCorrect = correctOrder === userOrder;
      } else if (activeQuiz.type === 'SORTING') {
          // Check if all items are categorized correctly
          isCorrect = activeQuiz.gameItems?.every(item => quizAnswer[item.id] === item.category) || false;
      }

      if (isCorrect) {
          soundService.playSuccess();
          setQuizFeedback('CORRECT');
          await supabaseService.submitQuiz(student.uid, activeQuiz.id, activeQuiz.question, 100, activeQuiz.reward);
          setTimeout(() => {
              setActiveQuiz(null);
              loadArcade();
              refreshUser(); // Update balance immediately
          }, 2000);
      } else {
          soundService.playPop(); // Error sound
          setQuizFeedback('WRONG');
      }
  };

  // Helper for Sentence Game
  const toggleSentenceWord = (word: string) => {
      const current = (quizAnswer as string[]) || [];
      if (current.includes(word)) {
          setQuizAnswer(current.filter(w => w !== word));
      } else {
          setQuizAnswer([...current, word]);
      }
  };

  // Helper for Sorting Game
  const setSortingCategory = (itemId: string, cat: 'NEED' | 'WANT') => {
      setQuizAnswer({ ...quizAnswer, [itemId]: cat });
  };

  return (
    <div className="space-y-6 pb-24">
       {/* HEADER DASHBOARD */}
       <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border-2 border-slate-100 relative overflow-hidden">
           <div className="relative z-10 flex items-center justify-between">
               <div className="flex items-center gap-4">
                   <div className="w-16 h-16 rounded-2xl bg-slate-100 border-2 border-slate-200 overflow-hidden">
                       <img src={student.avatar} className="w-full h-full object-cover" />
                   </div>
                   <div>
                       <h2 className="text-2xl font-black text-slate-800 leading-none mb-1">{student.displayName.split(' ')[0]}</h2>
                       <p className="text-xs font-bold text-slate-400">Nivel {Math.floor(student.xp / 1000) + 1} • {student.streakWeeks} Semanas Racha</p>
                   </div>
               </div>
               
               <button 
                  onClick={() => setShowFinanceModal(true)}
                  className="bg-amber-400 text-white px-4 py-2 rounded-2xl shadow-lg shadow-amber-200 border-b-4 border-amber-600 active:border-b-0 active:translate-y-1 transition-all flex flex-col items-center"
               >
                   <span className="text-[10px] font-black uppercase opacity-90">Mi Saldo</span>
                   <div className="flex items-center gap-1.5">
                       <img src="https://i.ibb.co/kVhqQ0K9/gemabit.png" className="w-6 h-6 object-contain drop-shadow-sm" />
                       <span className="text-xl font-black">{Math.floor(student.balance / 100)}</span>
                       <span className="text-xs font-bold opacity-80">.{student.balance % 100}</span>
                   </div>
               </button>
           </div>
       </div>

       {/* TABS */}
       <div className="flex p-1 bg-white rounded-2xl border-2 border-slate-100 shadow-sm">
           <button onClick={() => setActiveTab('TASKS')} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 ${activeTab === 'TASKS' ? 'bg-violet-100 text-violet-600' : 'text-slate-400'}`}>
               <CheckCircle2 size={18} /> MIS TAREAS
           </button>
           <button onClick={() => setActiveTab('ARCADE')} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 relative ${activeTab === 'ARCADE' ? 'bg-sky-100 text-sky-600' : 'text-slate-400'}`}>
               <Gamepad2 size={18} /> ARCADE
               {availableQuizzes.length > 0 && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
           </button>
       </div>

       {/* CONTENT - TASKS */}
       {activeTab === 'TASKS' && (
           <div className="space-y-6 animate-fade-in">
               <div className="bg-white rounded-[2rem] p-5 border-2 border-slate-100 shadow-sm">
                   <div className="flex items-center gap-2 mb-4 text-violet-600">
                       <div className="p-2 bg-violet-100 rounded-lg"><Star size={20}/></div>
                       <span className="font-black text-sm uppercase">Misiones de Escuela</span>
                   </div>
                   <TaskController studentId={student.uid} allowedType="SCHOOL" readOnly={true} />
               </div>

               <div className="bg-emerald-50 rounded-[2rem] p-5 border-2 border-emerald-100">
                   <div className="flex items-center gap-2 mb-4 text-emerald-600">
                       <div className="p-2 bg-emerald-100 rounded-lg"><Sparkles size={20}/></div>
                       <span className="font-black text-sm uppercase">Misiones de Casa</span>
                   </div>
                   <TaskController studentId={student.uid} allowedType="HOME" onUpdate={refreshUser} />
               </div>
           </div>
       )}

       {/* CONTENT - ARCADE */}
       {activeTab === 'ARCADE' && (
           <div className="grid grid-cols-2 gap-4 animate-fade-in">
               {availableQuizzes.length === 0 && (
                   <div className="col-span-2 py-10 text-center text-slate-400 font-bold border-4 border-dashed border-slate-200 rounded-[2rem]">
                       No hay juegos disponibles por ahora.
                   </div>
               )}
               {availableQuizzes.map(quiz => (
                   <button 
                      key={quiz.id} 
                      onClick={() => handleStartQuiz(quiz)}
                      className="bg-white p-4 rounded-[2rem] border-b-4 border-slate-200 hover:border-sky-400 hover:bg-sky-50 transition-all text-left group shadow-sm relative overflow-hidden"
                   >
                       <div className="absolute -right-4 -top-4 w-16 h-16 bg-sky-100 rounded-full opacity-0 group-hover:opacity-50 transition-opacity"></div>
                       <div className="flex justify-between items-start mb-3">
                           <div className="p-2 bg-sky-100 text-sky-600 rounded-xl group-hover:scale-110 transition-transform"><Gamepad2 size={20}/></div>
                           <span className="bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-1 rounded-lg flex items-center gap-1">
                               +{quiz.reward} <img src="https://i.ibb.co/JWvYtPhJ/minibit-1.png" className="w-3 h-3"/>
                           </span>
                       </div>
                       <p className="font-black text-slate-700 text-xs line-clamp-2 leading-tight">{quiz.question}</p>
                       <span className="text-[9px] font-bold text-slate-400 mt-2 block uppercase tracking-wide">
                           {quiz.type === 'TEXT' ? 'Trivia' : quiz.type === 'SENTENCE' ? 'Frase' : 'Juego'}
                       </span>
                   </button>
               ))}
           </div>
       )}

       {/* QUIZ MODAL */}
       {activeQuiz && (
           <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-6 z-[100] backdrop-blur-sm animate-fade-in">
               <div className="bg-white w-full max-w-md rounded-[2.5rem] p-6 shadow-2xl relative border-4 border-sky-300">
                   <button onClick={() => setActiveQuiz(null)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full text-slate-400 hover:bg-slate-200"><X size={20}/></button>
                   
                   <div className="text-center mb-6 mt-2">
                       <span className="bg-sky-100 text-sky-600 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest mb-2 inline-block">
                           {activeQuiz.type} GAME
                       </span>
                       <h3 className="text-xl font-black text-slate-800 leading-tight">{activeQuiz.question}</h3>
                   </div>

                   {/* GAME AREA */}
                   <div className="mb-8">
                       {/* TEXT & INTRUDER */}
                       {(activeQuiz.type === 'TEXT' || activeQuiz.type === 'INTRUDER') && (
                           <div className="grid gap-3">
                               {activeQuiz.options?.map((opt, idx) => (
                                   <button 
                                      key={idx}
                                      onClick={() => setQuizAnswer(idx)}
                                      className={`p-4 rounded-2xl border-2 font-bold text-sm transition-all ${
                                          quizAnswer === idx 
                                          ? 'border-sky-500 bg-sky-50 text-sky-700 shadow-md transform scale-105' 
                                          : 'border-slate-100 bg-white text-slate-600 hover:bg-slate-50'
                                      }`}
                                   >
                                       {opt}
                                   </button>
                               ))}
                           </div>
                       )}

                       {/* SECRET WORD */}
                       {activeQuiz.type === 'SECRET_WORD' && (
                           <input 
                              type="text" 
                              value={quizAnswer || ''}
                              onChange={e => setQuizAnswer(e.target.value)}
                              className="w-full bg-slate-100 border-2 border-slate-200 rounded-2xl p-4 text-center font-black text-2xl uppercase tracking-[0.2em] focus:border-sky-500 focus:outline-none"
                              placeholder="RESPUESTA"
                           />
                       )}

                       {/* SENTENCE */}
                       {activeQuiz.type === 'SENTENCE' && (
                           <div className="space-y-4">
                               <div className="min-h-[60px] bg-slate-100 rounded-2xl p-3 flex flex-wrap gap-2 justify-center border-2 border-dashed border-slate-200">
                                   {(quizAnswer as string[])?.length === 0 && <span className="text-slate-300 text-xs font-bold self-center">Toca las palabras en orden</span>}
                                   {(quizAnswer as string[])?.map((word, i) => (
                                       <button key={i} onClick={() => toggleSentenceWord(word)} className="bg-sky-500 text-white px-3 py-1.5 rounded-xl font-bold text-xs shadow-sm active:scale-95 transition-transform">
                                           {word}
                                       </button>
                                   ))}
                               </div>
                               <div className="flex flex-wrap gap-2 justify-center">
                                   {activeQuiz.gameItems?.map((item) => {
                                       const isSelected = (quizAnswer as string[])?.includes(item.text);
                                       return (
                                           <button 
                                              key={item.id} 
                                              onClick={() => toggleSentenceWord(item.text)} 
                                              disabled={isSelected}
                                              className={`px-3 py-2 rounded-xl font-bold text-xs border-2 transition-all ${isSelected ? 'opacity-0' : 'bg-white border-slate-200 text-slate-600 shadow-sm'}`}
                                           >
                                               {item.text}
                                           </button>
                                       );
                                   })}
                               </div>
                           </div>
                       )}

                       {/* SORTING */}
                       {activeQuiz.type === 'SORTING' && (
                           <div className="space-y-3">
                               {activeQuiz.gameItems?.map(item => (
                                   <div key={item.id} className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                                       <span className="font-black text-slate-700 text-sm">{item.text}</span>
                                       <div className="flex gap-2">
                                           <button 
                                              onClick={() => setSortingCategory(item.id, 'NEED')}
                                              className={`p-2 rounded-xl border-2 transition-all ${quizAnswer?.[item.id] === 'NEED' ? 'bg-emerald-500 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-300'}`}
                                           >
                                               <TrendingUp size={16}/>
                                           </button>
                                           <button 
                                              onClick={() => setSortingCategory(item.id, 'WANT')}
                                              className={`p-2 rounded-xl border-2 transition-all ${quizAnswer?.[item.id] === 'WANT' ? 'bg-pink-500 border-pink-600 text-white' : 'bg-white border-slate-200 text-slate-300'}`}
                                           >
                                               <Star size={16}/>
                                           </button>
                                       </div>
                                   </div>
                               ))}
                               <div className="flex justify-center gap-6 mt-2 text-[9px] font-black uppercase text-slate-400">
                                   <span className="flex items-center gap-1"><TrendingUp size={12} className="text-emerald-500"/> Vital</span>
                                   <span className="flex items-center gap-1"><Star size={12} className="text-pink-500"/> Capricho</span>
                               </div>
                           </div>
                       )}
                   </div>

                   {/* FEEDBACK & ACTION */}
                   {quizFeedback === 'CORRECT' ? (
                       <div className="bg-emerald-100 text-emerald-600 p-4 rounded-2xl text-center font-black animate-bounce-slow flex flex-col items-center">
                           <Trophy size={32} className="mb-2"/>
                           ¡EXCELENTE!
                           <span className="text-xs font-bold mt-1">Has ganado +{activeQuiz.reward} MB</span>
                       </div>
                   ) : quizFeedback === 'WRONG' ? (
                       <div className="bg-rose-100 text-rose-600 p-4 rounded-2xl text-center font-black animate-shake mb-4">
                           <AlertCircle size={32} className="mx-auto mb-2"/>
                           INTÉNTALO DE NUEVO
                       </div>
                   ) : null}

                   {!quizFeedback && (
                       <button 
                          onClick={handleCheckQuiz} 
                          className="w-full bg-sky-500 hover:bg-sky-400 text-white font-black py-4 rounded-2xl border-b-[6px] border-sky-700 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-widest shadow-xl shadow-sky-100"
                       >
                           COMPROBAR
                       </button>
                   )}
               </div>
           </div>
       )}

      {/* FINANCE MODAL (MI TESORO) */}
      {showFinanceModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fade-in">
             <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl border-4 border-amber-300 relative overflow-hidden flex flex-col max-h-[90vh]">
                 
                 {/* HEADER */}
                 <div className="bg-amber-400 p-6 text-center relative border-b-4 border-amber-500">
                     <button onClick={() => setShowFinanceModal(false)} className="absolute top-4 right-4 p-2 bg-amber-500 rounded-full text-white hover:bg-amber-600 transition-colors shadow-sm">
                        <X size={20} strokeWidth={3}/>
                     </button>
                     <div className="inline-block p-3 bg-white/20 rounded-2xl backdrop-blur-sm border-2 border-white/40 mb-2 shadow-inner">
                        <TrendingUp size={32} className="text-white drop-shadow-md" strokeWidth={3}/>
                     </div>
                     <h3 className="text-2xl font-black text-white drop-shadow-md tracking-tight">Mi Tesoro</h3>
                     <p className="text-amber-50 text-xs font-bold mt-1 uppercase tracking-widest opacity-90">Tu Historia de Monedas</p>
                 </div>

                 <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
                     
                     {/* TIMEFRAME SELECTOR */}
                     <div className="flex justify-center mb-8">
                         <div className="bg-white p-1.5 rounded-2xl flex gap-1 shadow-sm border border-slate-100">
                             {['DAY', 'WEEK', 'MONTH', 'ALL'].map(t => (
                                 <button
                                    key={t}
                                    onClick={() => setFinanceTimeframe(t as any)}
                                    className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${financeTimeframe === t ? 'bg-amber-400 text-white shadow-md transform scale-105' : 'text-slate-400 hover:bg-slate-50'}`}
                                 >
                                     {t === 'DAY' ? 'Hoy' : t === 'WEEK' ? 'Semana' : t === 'MONTH' ? 'Mes' : 'Todo'}
                                 </button>
                             ))}
                         </div>
                     </div>

                     {/* VISUAL CHART */}
                     <div className="bg-white rounded-3xl p-6 border-2 border-slate-100 shadow-sm mb-8 relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-slate-100"></div>
                        <div className="flex items-end justify-center gap-12 h-40 pt-4">
                            {/* EARNED BAR */}
                            <div className="flex flex-col items-center gap-2 w-16 group relative">
                                <div className="absolute -top-8 bg-emerald-500 text-white text-xs font-black px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg mb-1 whitespace-nowrap z-10">
                                    +{totalEarned} MB
                                </div>
                                <div className="w-full bg-emerald-50 rounded-t-2xl relative overflow-hidden flex items-end border-x-2 border-t-2 border-emerald-100 shadow-inner" style={{height: '100%'}}>
                                    <div 
                                        className="w-full bg-gradient-to-t from-emerald-400 to-emerald-300 relative transition-all duration-1000 ease-out" 
                                        style={{height: `${Math.max((totalEarned / Math.max(totalEarned, totalSpent, 1)) * 100, 5)}%`}}
                                    >
                                        <div className="absolute top-0 left-0 w-full h-1 bg-white/30"></div>
                                    </div>
                                </div>
                                <div className="bg-emerald-100 p-2.5 rounded-xl text-emerald-600 shadow-sm border border-emerald-200 z-10 -mt-4 bg-white">
                                    <ArrowUpCircle size={24} strokeWidth={3}/>
                                </div>
                                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Ganado</span>
                            </div>

                            {/* SPENT BAR */}
                            <div className="flex flex-col items-center gap-2 w-16 group relative">
                                <div className="absolute -top-8 bg-rose-500 text-white text-xs font-black px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg mb-1 whitespace-nowrap z-10">
                                    -{totalSpent} MB
                                </div>
                                <div className="w-full bg-rose-50 rounded-t-2xl relative overflow-hidden flex items-end border-x-2 border-t-2 border-rose-100 shadow-inner" style={{height: '100%'}}>
                                    <div 
                                        className="w-full bg-gradient-to-t from-rose-400 to-rose-300 relative transition-all duration-1000 ease-out" 
                                        style={{height: `${Math.max((totalSpent / Math.max(totalEarned, totalSpent, 1)) * 100, 5)}%`}}
                                    >
                                        <div className="absolute top-0 left-0 w-full h-1 bg-white/30"></div>
                                    </div>
                                </div>
                                <div className="bg-rose-100 p-2.5 rounded-xl text-rose-600 shadow-sm border border-rose-200 z-10 -mt-4 bg-white">
                                    <ArrowDownCircle size={24} strokeWidth={3}/>
                                </div>
                                <span className="text-[10px] font-black text-rose-600 uppercase tracking-wider">Usado</span>
                            </div>
                        </div>
                     </div>

                     {/* TRANSACTION LIST */}
                     <h4 className="font-black text-slate-400 text-xs uppercase tracking-widest mb-4 pl-2 flex items-center gap-2">
                        <History size={14}/> Movimientos
                     </h4>
                     
                     {filteredTransactions.length === 0 ? (
                         <div className="flex flex-col items-center justify-center py-10 text-slate-300 bg-white border-4 border-dashed border-slate-100 rounded-3xl">
                             <div className="bg-slate-50 p-4 rounded-full mb-3">
                                <Calendar size={32} />
                             </div>
                             <span className="font-black text-sm">Nada por aquí</span>
                             <span className="text-xs font-bold opacity-60">¡Empieza a ganar monedas!</span>
                         </div>
                     ) : (
                         <div className="space-y-3 pb-4">
                             {filteredTransactions.map((t, idx) => {
                                 const isEarn = t.type === 'EARN';
                                 
                                 // Smart Icon Logic
                                 let Icon = isEarn ? Plus : ShoppingBag;
                                 let colorClass = isEarn ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600';
                                 
                                 if (t.description.includes('Ahorro')) {
                                     Icon = PiggyBank;
                                     colorClass = 'bg-amber-100 text-amber-600'; // Spending but Saving
                                 } else if (t.description.includes('Retiro')) {
                                     Icon = Wallet;
                                     colorClass = 'bg-indigo-100 text-indigo-600'; // Income from savings
                                 } else if (t.description.includes('Tarea')) {
                                     Icon = CheckCircle2;
                                     colorClass = 'bg-violet-100 text-violet-600';
                                 } else if (t.description.includes('Juego') || t.description.includes('Quiz')) {
                                     Icon = Gamepad2;
                                     colorClass = 'bg-sky-100 text-sky-600';
                                 }

                                 return (
                                     <div key={t.id} className="bg-white p-3 rounded-2xl border-b-4 border-slate-100 shadow-sm flex items-center justify-between group hover:border-amber-200 transition-colors">
                                         <div className="flex items-center gap-3">
                                             <div className={`p-3 rounded-xl ${colorClass} group-hover:scale-110 transition-transform`}>
                                                 <Icon size={18} strokeWidth={3}/>
                                             </div>
                                             <div>
                                                 <p className="font-black text-slate-700 text-xs line-clamp-1">{t.description}</p>
                                                 <p className="text-[10px] font-bold text-slate-400">{new Date(t.timestamp).toLocaleDateString()}</p>
                                             </div>
                                         </div>
                                         <div className={`font-black text-base flex items-center gap-1 ${isEarn ? 'text-emerald-500' : 'text-rose-500'}`}>
                                             {isEarn ? '+' : '-'}{Math.abs(t.amount)}
                                             <img src="https://i.ibb.co/JWvYtPhJ/minibit-1.png" className="w-3.5 h-3.5 object-contain opacity-70"/>
                                         </div>
                                     </div>
                                 );
                             })}
                         </div>
                     )}
                 </div>
             </div>
        </div>
      )}
    </div>
  );
};
