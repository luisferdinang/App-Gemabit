
import React, { useState, useEffect } from 'react';
import { User, ExpenseRequest, Transaction } from '../types';
import { supabaseService, getCurrentWeekId } from '../services/supabaseService';
import { TaskController } from './TaskController';
import { User as UserIcon, Link as LinkIcon, School, Home, Coins, Trophy, AlertTriangle, Check, X, History, TrendingDown, Calendar, Gamepad2, ArrowUpCircle, ArrowDownCircle, Sparkles, ChevronDown, Lock, RefreshCw, CheckCircle2, Loader2 } from 'lucide-react';
import { getWeekDateRange } from '../utils/dateUtils';
import { soundService } from '../services/soundService';

interface ParentViewProps {
  currentUser: User;
}

export const ParentView: React.FC<ParentViewProps> = ({ currentUser }) => {
  const [children, setChildren] = useState<User[]>([]);
  const [selectedChild, setSelectedChild] = useState<string | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [linkCode, setLinkCode] = useState('');
  
  // States for stability and feedback
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [successIds, setSuccessIds] = useState<Set<string>>(new Set());
  
  // Expenses & Transactions State
  const [pendingExpenses, setPendingExpenses] = useState<ExpenseRequest[]>([]);
  const [childTransactions, setChildTransactions] = useState<Transaction[]>([]);
  
  // Week Navigation State
  const [availableWeeks, setAvailableWeeks] = useState<{weekId: string, completion: number}[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>(getCurrentWeekId());

  // Initial Load & Subscriptions
  useEffect(() => {
    loadParentData();
    
    const subParent = supabaseService.subscribeToChanges('profiles', `id=eq.${currentUser.uid}`, () => { loadParentData(); });
    const subExpenses = supabaseService.subscribeToChanges('expense_requests', undefined, () => { 
        // Solo recargamos si no hay una operación de éxito en curso para evitar saltos en la lista
        if (successIds.size === 0 && !processingId) {
            loadParentData(); 
        }
    });
    const subTransactions = supabaseService.subscribeToChanges('transactions', undefined, () => {
        if (selectedChild) loadChildHistory(selectedChild);
    });

    return () => {
        subParent.unsubscribe();
        subExpenses.unsubscribe();
        subTransactions.unsubscribe();
    };
  }, [currentUser.uid, selectedChild, processingId, successIds]);

  useEffect(() => {
      if (selectedChild) {
          loadChildHistory(selectedChild);
          loadChildWeeks(selectedChild);
          setSelectedWeek(getCurrentWeekId());
      }
  }, [selectedChild]);

  const loadParentData = async () => {
    const updatedParent = await supabaseService.getStudentById(currentUser.uid); 
    const linkedIds = updatedParent?.linkedStudentIds || currentUser.linkedStudentIds || [];

    if (linkedIds.length > 0) {
      const allStudents = await supabaseService.getStudents();
      const myKids = allStudents.filter(s => linkedIds.includes(s.uid));
      setChildren(myKids);
      
      if (myKids.length > 0 && (!selectedChild || !myKids.find(k => k.uid === selectedChild))) {
        setSelectedChild(myKids[0].uid);
      }
      
      const expenses = await supabaseService.getPendingExpensesForParent(myKids.map(k => k.uid));
      // Solo mantenemos en el estado las que no acabamos de aprobar exitosamente
      setPendingExpenses(expenses.filter(e => !successIds.has(e.id)));
    }
  };

  const loadChildHistory = async (childId: string) => {
      const transactions = await supabaseService.getTransactions(childId);
      setChildTransactions(transactions);
  };

  const loadChildWeeks = async (childId: string) => {
      const weeks = await supabaseService.getStudentWeeks(childId);
      const current = getCurrentWeekId();
      if (!weeks.find(w => w.weekId === current)) {
          weeks.push({ weekId: current, completion: 0 });
      }
      weeks.sort((a, b) => b.weekId.localeCompare(a.weekId));
      setAvailableWeeks(weeks);
  };

  const handleApproveExpense = async (id: string) => {
      if (processingId || successIds.has(id)) return;
      
      setProcessingId(id);
      try {
          const result = await supabaseService.approveExpense(id);
          if (result && result.success) {
              soundService.playSuccess();
              
              // 1. Marcar como éxito visual
              setSuccessIds(prev => new Set(prev).add(id));
              
              // 2. Esperar 1.5 segundos para que el padre vea el mensaje de "APROBADO"
              setTimeout(() => {
                  // 3. Eliminar de la lista local para que desaparezca
                  setPendingExpenses(prev => prev.filter(e => e.id !== id));
                  setProcessingId(null);
                  
                  // 4. Limpiar ID de éxito y recargar datos (saldos, etc)
                  setSuccessIds(prev => {
                      const next = new Set(prev);
                      next.delete(id);
                      return next;
                  });
                  loadParentData();
              }, 1500);
          } else {
              alert("Error: " + (result?.error || "No se pudo procesar"));
              setProcessingId(null);
          }
      } catch (e) {
          alert("Error de conexión");
          setProcessingId(null);
      }
  };

  const handleRejectExpense = async (id: string) => {
      if (processingId || successIds.has(id)) return;
      setProcessingId(id);
      try {
          await supabaseService.rejectExpense(id);
          setPendingExpenses(prev => prev.filter(e => e.id !== id));
          setProcessingId(null);
          loadParentData();
      } catch (e) {
          alert("Error al rechazar");
          setProcessingId(null);
      }
  };

  const handleManualRefresh = async () => {
      if (isRefreshing) return;
      setIsRefreshing(true);
      soundService.playPop();
      await loadParentData();
      if (selectedChild) {
          await loadChildHistory(selectedChild);
          await loadChildWeeks(selectedChild);
      }
      setTimeout(() => setIsRefreshing(false), 800);
  };

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await supabaseService.linkParent(currentUser.uid, linkCode);
      alert("¡Vinculación exitosa!");
      setIsLinking(false);
      setLinkCode('');
      loadParentData();
    } catch (err) {
      alert("Código incorrecto o error al vincular");
    }
  };

  const activeKid = children.find(c => c.uid === selectedChild);
  const gemCount = activeKid ? Math.floor(activeKid.balance / 100) : 0;
  const miniBitCount = activeKid ? activeKid.balance % 100 : 0;
  const isPastWeek = selectedWeek !== getCurrentWeekId();

  const getTransactionVisuals = (t: Transaction) => {
      const desc = t.description.toUpperCase();
      const isEarn = t.type === 'EARN';
      if (!isEarn) {
          if (desc.includes('AHORRO')) return { icon: <Coins size={18}/>, bg: 'bg-indigo-100', text: 'text-indigo-600', label: 'Ahorro' };
          return { icon: <TrendingDown size={18}/>, bg: 'bg-rose-100', text: 'text-rose-600', label: 'Gasto' };
      }
      if (desc.includes('QUIZ') || desc.includes('JUEGO')) return { icon: <Gamepad2 size={18}/>, bg: 'bg-sky-100', text: 'text-sky-600', label: 'Arcade' };
      if (desc.includes('SCHOOL') || desc.includes('ASISTENCIA')) return { icon: <School size={18}/>, bg: 'bg-violet-100', text: 'text-violet-600', label: 'Escuela' };
      if (desc.includes('HOME') || desc.includes('HOGAR')) return { icon: <Home size={18}/>, bg: 'bg-emerald-100', text: 'text-emerald-600', label: 'Casa' };
      return { icon: <Sparkles size={18}/>, bg: 'bg-amber-100', text: 'text-amber-600', label: 'Premio' };
  };

  return (
    <div className="animate-fade-in pb-10">
      <div className="flex justify-between items-center mb-6">
         <h2 className="text-2xl font-black text-slate-800">Panel de Padres</h2>
         <div className="flex gap-2">
             <button onClick={handleManualRefresh} disabled={isRefreshing} className="bg-white text-slate-400 hover:text-emerald-500 p-2.5 rounded-xl border-2 border-slate-100 hover:border-emerald-100 transition-all active:scale-95 shadow-sm">
                <RefreshCw size={20} className={isRefreshing ? 'animate-spin' : ''} />
             </button>
             <button onClick={() => setIsLinking(!isLinking)} className="bg-slate-800 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-slate-700 transition-colors shadow-lg active:scale-95">
               <LinkIcon size={16} /> Vincular
             </button>
         </div>
      </div>

      {isLinking && (
        <div className="mb-6 bg-yellow-50 p-4 rounded-3xl border-2 border-yellow-200 animate-fade-in">
           <form onSubmit={handleLink} className="flex gap-2">
             <input type="text" placeholder="Código de 6 dígitos" className="flex-1 p-3 rounded-2xl border-2 border-yellow-200 font-bold focus:outline-none focus:border-yellow-500 bg-white" value={linkCode} onChange={e => setLinkCode(e.target.value)} />
             <button type="submit" className="bg-yellow-400 text-yellow-900 font-bold px-6 rounded-2xl border-b-4 border-yellow-600 active:border-b-0 active:translate-y-1 transition-all">Vincular</button>
           </form>
        </div>
      )}
      
      {/* SECCIÓN DE SOLICITUDES PENDIENTES */}
      {pendingExpenses.length > 0 && (
          <div className="mb-8 bg-rose-50 border-2 border-rose-200 rounded-[2.5rem] p-6 animate-fade-in shadow-md">
              <h3 className="font-black text-rose-700 text-lg mb-4 flex items-center gap-2 uppercase tracking-tight">
                  <AlertTriangle className="text-rose-500" size={20} /> Solicitudes Pendientes
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                  {pendingExpenses.map(req => {
                      const isProcessing = processingId === req.id;
                      const isSuccess = successIds.has(req.id);

                      return (
                        <div key={req.id} className={`bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between border-2 transition-all relative overflow-hidden ${isSuccess ? 'border-emerald-500 bg-emerald-50 scale-95 opacity-50' : 'border-rose-100'}`}>
                            
                            {/* OVERLAY DE ÉXITO DEFINITIVO */}
                            {isSuccess && (
                                <div className="absolute inset-0 z-30 bg-emerald-500 flex flex-col items-center justify-center text-white animate-fade-in">
                                    <CheckCircle2 size={40} className="animate-bounce" />
                                    <span className="font-black text-sm mt-1 uppercase tracking-widest">¡APROBADO CON ÉXITO!</span>
                                </div>
                            )}

                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0 border-2 border-slate-50">
                                    <img src={req.studentAvatar} className="w-full h-full object-cover" alt="Avatar" />
                                </div>
                                <div className="max-w-[140px]">
                                    <p className="font-black text-slate-800 text-sm truncate">{req.studentName}</p>
                                    <p className="text-slate-500 text-xs font-bold truncate">Desea: <span className="text-slate-700">{req.description}</span></p>
                                    <div className="flex gap-1 mt-1">
                                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full border ${req.category === 'NEED' ? 'bg-emerald-100 text-emerald-600 border-emerald-200' : 'bg-pink-100 text-pink-600 border-pink-200'}`}>
                                            {req.category === 'NEED' ? 'NECESIDAD' : 'CAPRICHO'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <span className="font-black text-rose-600 text-lg">-{req.amount}</span>
                                <div className="flex flex-col gap-1.5">
                                    <button 
                                        disabled={!!processingId || isSuccess}
                                        onClick={() => handleApproveExpense(req.id)} 
                                        className={`p-2 rounded-xl shadow-sm transition-all border-b-4 ${isProcessing ? 'bg-slate-100 border-slate-200' : 'bg-emerald-500 border-emerald-700 text-white hover:bg-emerald-600 active:translate-y-1 active:border-b-0'}`}
                                    >
                                        {isProcessing ? <Loader2 size={18} className="animate-spin text-slate-400" /> : <Check size={18} strokeWidth={4}/>}
                                    </button>
                                    <button 
                                        disabled={!!processingId || isSuccess}
                                        onClick={() => handleRejectExpense(req.id)} 
                                        className={`p-2 rounded-xl shadow-sm transition-all border-b-4 ${isProcessing ? 'bg-slate-50 border-slate-100' : 'bg-slate-200 border-slate-400 text-slate-500 hover:bg-slate-300 active:translate-y-1 active:border-b-0'}`}
                                    >
                                        <X size={18} strokeWidth={4}/>
                                    </button>
                                </div>
                            </div>
                        </div>
                      );
                  })}
              </div>
          </div>
      )}

      <div className="grid md:grid-cols-4 gap-6">
        {/* Sidebar Hijos */}
        <div className="md:col-span-1 space-y-3">
          <h3 className="font-bold text-slate-400 text-[10px] uppercase tracking-widest mb-2 pl-2">Mis Hijos</h3>
          {children.length === 0 && (
             <div className="p-6 bg-slate-50 rounded-3xl text-slate-400 text-sm font-bold text-center border-2 border-dashed border-slate-200 opacity-60">
                <UserIcon size={32} className="mx-auto mb-2 opacity-50"/> No hay vinculados.
             </div>
          )}
          {children.map(s => (
            <button key={s.uid} onClick={() => setSelectedChild(s.uid)} className={`w-full text-left p-3 rounded-2xl flex items-center gap-3 border-2 transition-all ${selectedChild === s.uid ? 'border-emerald-500 bg-emerald-50 shadow-md scale-105 z-10' : 'border-white bg-white hover:border-slate-100'}`}>
              <div className="w-12 h-12 rounded-full border-2 border-white shadow-sm overflow-hidden bg-slate-100">
                   <img src={s.avatar} alt="Avatar" className="w-full h-full object-cover" />
              </div>
              <div>
                <div className="font-black text-slate-700 text-sm">{s.displayName.split(' ')[0]}</div>
                <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1">
                   {Math.floor(s.balance / 100)} GB • {s.balance % 100} MB
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Dashboard Principal */}
        <div className="md:col-span-3">
           {activeKid ? (
             <div className="animate-fade-in space-y-6">
               
               {/* Resumen Superior */}
               <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-[2.5rem] p-6 text-white shadow-xl shadow-emerald-100 relative overflow-hidden">
                  <div className="relative z-10 flex items-center gap-4">
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl p-1 border-2 border-white/30 shrink-0">
                           <img src={activeKid.avatar} className="w-full h-full object-cover rounded-xl" alt="Avatar" />
                        </div>
                        <div>
                           <h2 className="text-2xl font-black">{activeKid.displayName}</h2>
                           <div className="flex flex-wrap gap-2 mt-2">
                              <span className="bg-white text-emerald-600 px-3 py-1 rounded-full text-xs font-black flex items-center gap-1.5 shadow-sm border border-emerald-100">
                                <img src="https://i.ibb.co/kVhqQ0K9/gemabit.png" className="w-4 h-4 object-contain" alt="GB" /> {gemCount} GB
                              </span>
                              <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold border border-white/30 backdrop-blur-sm">
                                {miniBitCount} MiniBits
                              </span>
                              <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-bold border border-white/30 backdrop-blur-sm">
                                Racha: {activeKid.streakWeeks} Sem.
                              </span>
                           </div>
                        </div>
                  </div>
                  <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
               </div>

               {/* Seleccion de Semana */}
               <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm w-fit">
                   <div className="p-2 bg-slate-50 text-slate-400 rounded-xl"><Calendar size={18}/></div>
                   <div className="relative pr-6">
                       <select value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)} className="appearance-none bg-transparent font-black text-slate-700 text-sm focus:outline-none cursor-pointer">
                           {availableWeeks.map(week => (<option key={week.weekId} value={week.weekId}>Semana {week.weekId.split('-W')[1]} ({week.weekId === getCurrentWeekId() ? 'Actual' : getWeekDateRange(week.weekId)})</option>))}
                       </select>
                       <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                   </div>
               </div>

               <div className="grid md:grid-cols-2 gap-6">
                  {/* Tareas del Hogar */}
                  <div className={`rounded-[2rem] p-6 border-2 shadow-sm relative overflow-hidden transition-colors ${isPastWeek ? 'bg-slate-50 border-slate-200 opacity-80' : 'bg-white border-slate-100'}`}>
                     <div className="flex items-center gap-3 mb-6 relative z-10">
                        <div className={`p-3 rounded-xl ${isPastWeek ? 'bg-slate-200 text-slate-500' : 'bg-emerald-100 text-emerald-600'}`}>
                           {isPastWeek ? <Lock size={20}/> : <Home size={20} strokeWidth={3} />}
                        </div>
                        <h3 className="font-black text-slate-700 text-lg">Misiones Casa</h3>
                     </div>
                     <TaskController studentId={activeKid.uid} allowedType="HOME" weekId={selectedWeek} onUpdate={loadParentData} readOnly={isPastWeek} />
                  </div>

                  {/* Tareas Escolares */}
                  <div className="bg-slate-50 rounded-[2rem] p-6 border-2 border-slate-100 opacity-80">
                     <div className="flex items-center gap-3 mb-6 relative z-10">
                        <div className="p-3 bg-violet-100 text-violet-600 rounded-xl">
                           <School size={20} strokeWidth={3} />
                        </div>
                        <h3 className="font-black text-slate-700 text-lg">Escuela</h3>
                     </div>
                     <TaskController studentId={activeKid.uid} allowedType="SCHOOL" readOnly={true} weekId={selectedWeek} />
                  </div>
               </div>

               {/* Historial de Movimientos */}
               <div className="bg-white rounded-[2rem] p-6 border-2 border-slate-100 shadow-sm">
                   <div className="flex items-center gap-3 mb-6">
                       <div className="p-3 bg-amber-100 text-amber-600 rounded-xl"><History size={20} strokeWidth={3} /></div>
                       <h3 className="font-black text-slate-700 text-lg">Historial</h3>
                   </div>
                   {childTransactions.length === 0 ? (
                       <p className="text-center text-slate-400 font-bold text-xs py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-100 opacity-60">Sin movimientos aún.</p>
                   ) : (
                       <div className="space-y-3 max-h-80 overflow-y-auto pr-2 custom-scrollbar">
                           {childTransactions.map((t) => {
                               const visuals = getTransactionVisuals(t);
                               return (
                                   <div key={t.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                                       <div className="flex items-center gap-3">
                                           <div className={`p-2 rounded-xl ${visuals.bg} ${visuals.text}`}>{visuals.icon}</div>
                                           <div>
                                               <p className="font-black text-slate-700 text-xs line-clamp-1 uppercase">{t.description}</p>
                                               <p className="text-[9px] font-bold text-slate-400">{new Date(t.timestamp).toLocaleDateString()} • {visuals.label}</p>
                                           </div>
                                       </div>
                                       <div className={`font-black text-sm flex items-center gap-1 ${t.type === 'EARN' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                           {t.type === 'EARN' ? '+' : ''}{t.amount} MB
                                       </div>
                                   </div>
                               );
                           })}
                       </div>
                   )}
               </div>

             </div>
           ) : (
             <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-300 border-4 border-dashed border-slate-200 rounded-[3rem] bg-slate-50/50">
                <UserIcon size={48} className="text-slate-200 mb-4" />
                <span className="font-black text-lg">Selecciona un hijo</span>
                <p className="text-sm font-bold opacity-60">Para supervisar su progreso</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};
