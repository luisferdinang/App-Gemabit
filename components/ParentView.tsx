
import React, { useState, useEffect } from 'react';
import { User, ExpenseRequest, Transaction } from '../types';
import { supabaseService, getCurrentWeekId } from '../services/supabaseService';
import { TaskController } from './TaskController';
import { User as UserIcon, Link as LinkIcon, School, Home, Coins, Trophy, AlertTriangle, Check, X, History, TrendingDown, Calendar, Gamepad2, ArrowUpCircle, ArrowDownCircle, Sparkles, ChevronDown, Lock, RefreshCw } from 'lucide-react';
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
  
  // Refresh State
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Expenses & Transactions State
  const [pendingExpenses, setPendingExpenses] = useState<ExpenseRequest[]>([]);
  const [childTransactions, setChildTransactions] = useState<Transaction[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null); // To prevent double clicks

  // Week Navigation State
  const [availableWeeks, setAvailableWeeks] = useState<{weekId: string, completion: number}[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>(getCurrentWeekId());

  // 1. Carga inicial
  useEffect(() => {
    loadParentData();
    
    const subParent = supabaseService.subscribeToChanges('profiles', `id=eq.${currentUser.uid}`, () => { loadParentData(); });
    const subProfiles = supabaseService.subscribeToChanges('profiles', undefined, () => { loadParentData(); });
    const subExpenses = supabaseService.subscribeToChanges('expense_requests', undefined, () => { loadParentData(); });
    const subTransactions = supabaseService.subscribeToChanges('transactions', undefined, () => {
        if (selectedChild) loadChildHistory(selectedChild);
    });
    // Escuchar tareas para actualizar historial de semanas
    const subTasks = supabaseService.subscribeToChanges('tasks', undefined, () => {
        if (selectedChild) loadChildWeeks(selectedChild);
    });

    return () => {
        subParent.unsubscribe();
        subProfiles.unsubscribe();
        subExpenses.unsubscribe();
        subTransactions.unsubscribe();
        subTasks.unsubscribe();
    };
  }, [currentUser.uid]);

  // 2. Efecto para cargar historial y semanas cuando cambia el niño
  useEffect(() => {
      if (selectedChild) {
          loadChildHistory(selectedChild);
          loadChildWeeks(selectedChild);
          setSelectedWeek(getCurrentWeekId()); // Reset to current week on child switch
      } else {
          setChildTransactions([]);
          setAvailableWeeks([]);
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
      setPendingExpenses(expenses);
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

  const loadChildHistory = async (childId: string) => {
      const transactions = await supabaseService.getTransactions(childId);
      setChildTransactions(transactions);
  };

  const loadChildWeeks = async (childId: string) => {
      const weeks = await supabaseService.getStudentWeeks(childId);
      // Asegurar que la semana actual esté en la lista aunque no tenga tareas
      const current = getCurrentWeekId();
      if (!weeks.find(w => w.weekId === current)) {
          weeks.push({ weekId: current, completion: 0 });
      }
      // Ordenar descendente (más reciente primero)
      weeks.sort((a, b) => b.weekId.localeCompare(a.weekId));
      setAvailableWeeks(weeks);
  };

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await supabaseService.linkParent(currentUser.uid, linkCode);
      alert("¡Vinculación exitosa!");
      setIsLinking(false);
      setLinkCode('');
    } catch (err) {
      alert("Código incorrecto o error al vincular");
    }
  };
  
  const handleChildUpdate = () => {
      loadParentData(); 
      if (selectedChild) {
          loadChildHistory(selectedChild);
          loadChildWeeks(selectedChild);
      }
  };

  const handleApproveExpense = async (id: string) => {
      if (processingId) return;
      setProcessingId(id);
      
      try {
          const result = await supabaseService.approveExpense(id);
          if (result && result.success) {
              soundService.playSuccess();
              alert("✅ Gasto aprobado correctamente.");
              loadParentData(); // Forzar recarga inmediata
          } else {
              alert("Error: " + (result?.error || "Desconocido"));
          }
      } catch (e: any) {
          alert("Error: " + e.message);
      } finally {
          setProcessingId(null);
      }
  };

  const handleRejectExpense = async (id: string) => {
      if (processingId) return;
      setProcessingId(id);
      await supabaseService.rejectExpense(id);
      setProcessingId(null);
      loadParentData();
  };

  const activeKid = children.find(c => c.uid === selectedChild);
  const gemCount = activeKid ? Math.floor(activeKid.balance / 100) : 0;
  const miniBitCount = activeKid ? activeKid.balance % 100 : 0;
  const isPastWeek = selectedWeek !== getCurrentWeekId();

  // --- VISUAL HELPERS ---
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
      if (desc.includes('RETIRO')) return { icon: <Coins size={18}/>, bg: 'bg-indigo-100', text: 'text-indigo-600', label: 'Retiro Meta' };
      return { icon: <Sparkles size={18}/>, bg: 'bg-amber-100', text: 'text-amber-600', label: 'Premio' };
  };

  const translateDescription = (text: string) => {
    return text
      .replace('ATTENDANCE', 'Asistencia')
      .replace('RESPONSIBILITY', 'Responsabilidad')
      .replace('BEHAVIOR', 'Comportamiento')
      .replace('RESPECT', 'Respeto')
      .replace('PARTICIPATION', 'Participación')
      .replace('CHORES', 'Quehaceres')
      .replace('HYGIENE', 'Higiene')
      .replace('READING', 'Lectura');
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
         <h2 className="text-2xl font-black text-slate-800">Panel de Padres</h2>
         <div className="flex gap-2">
             <button
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                className="bg-white text-slate-400 hover:text-slate-600 p-2.5 rounded-xl border-2 border-slate-100 hover:border-slate-200 transition-all active:scale-95 shadow-sm"
                title="Actualizar Datos"
             >
                <RefreshCw size={20} className={isRefreshing ? 'animate-spin text-emerald-500' : ''} />
             </button>
             <button 
               onClick={() => setIsLinking(!isLinking)}
               className="bg-slate-800 text-white px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 hover:bg-slate-700 transition-colors shadow-lg shadow-slate-300 active:scale-95"
             >
               <LinkIcon size={16} /> Vincular Alumno
             </button>
         </div>
      </div>

      {isLinking && (
        <div className="mb-6 bg-yellow-50 p-4 rounded-3xl border-2 border-yellow-200 animate-fade-in">
           <form onSubmit={handleLink} className="flex gap-2">
             <input 
               type="text" 
               placeholder="Código de 6 dígitos (ej. 102030)" 
               className="flex-1 p-3 rounded-2xl border-2 border-yellow-200 font-bold text-slate-700 focus:outline-none focus:border-yellow-500 bg-white"
               value={linkCode}
               onChange={e => setLinkCode(e.target.value)}
             />
             <button type="submit" className="bg-yellow-400 text-yellow-900 font-bold px-6 rounded-2xl border-b-4 border-yellow-600 active:border-b-0 active:translate-y-1 transition-all">
               Vincular
             </button>
           </form>
           <p className="text-xs text-slate-500 mt-2 font-bold ml-1">ℹ️ El código está en el perfil de tu hijo (icono naranja).</p>
        </div>
      )}
      
      {/* PENDING EXPENSE ALERT */}
      {pendingExpenses.length > 0 && (
          <div className="mb-8 bg-rose-50 border-2 border-rose-200 rounded-[2.5rem] p-6 animate-pulse-slow">
              <h3 className="font-black text-rose-700 text-lg mb-4 flex items-center gap-2">
                  <AlertTriangle className="text-rose-500" /> Solicitudes de Gasto Pendientes
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                  {pendingExpenses.map(req => (
                      <div key={req.id} className="bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between border border-rose-100">
                          <div className="flex items-center gap-3">
                              <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0 border-2 border-rose-50">
                                  <img src={req.studentAvatar} className="w-full h-full object-cover"/>
                              </div>
                              <div>
                                  <p className="font-black text-slate-800 text-sm">{req.studentName}</p>
                                  <p className="text-slate-500 text-xs font-bold">Desea: <span className="text-slate-700">{req.description}</span></p>
                                  {req.category === 'NEED' && <span className="text-[9px] font-black bg-emerald-100 text-emerald-600 px-2 py-0.5 rounded-full mt-1 inline-block">NECESIDAD</span>}
                                  {req.category === 'WANT' && <span className="text-[9px] font-black bg-pink-100 text-pink-600 px-2 py-0.5 rounded-full mt-1 inline-block">CAPRICHO</span>}
                              </div>
                          </div>
                          <div className="flex items-center gap-3">
                              <span className="font-black text-rose-600 text-lg">-{req.amount}</span>
                              <div className="flex flex-col gap-1">
                                  <button 
                                    onClick={() => handleApproveExpense(req.id)} 
                                    disabled={processingId === req.id}
                                    className={`p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 shadow-sm transition-all ${processingId === req.id ? 'opacity-50 scale-95' : ''}`}
                                  >
                                    {processingId === req.id ? <RefreshCw size={16} className="animate-spin"/> : <Check size={16}/>}
                                  </button>
                                  <button 
                                    onClick={() => handleRejectExpense(req.id)} 
                                    disabled={processingId === req.id}
                                    className="p-2 bg-slate-200 text-slate-500 rounded-lg hover:bg-slate-300 shadow-sm"
                                  >
                                    <X size={16}/>
                                  </button>
                              </div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

      <div className="grid md:grid-cols-4 gap-6">
        {/* Sidebar List */}
        <div className="md:col-span-1 space-y-3">
          <h3 className="font-bold text-slate-400 text-xs uppercase tracking-wider mb-2">Mis Hijos</h3>
          {children.length === 0 && (
             <div className="p-6 bg-slate-100 rounded-3xl text-slate-400 text-sm font-bold text-center border-2 border-dashed border-slate-200">
                <UserIcon size={32} className="mx-auto mb-2 opacity-50"/>
                No hay cuentas vinculadas.
             </div>
          )}
          {children.map(s => (
            <button
              key={s.uid}
              onClick={() => setSelectedChild(s.uid)}
              className={`w-full text-left p-3 rounded-2xl flex items-center gap-3 border-2 transition-all ${
                selectedChild === s.uid 
                  ? 'border-emerald-500 bg-emerald-50 shadow-md scale-105' 
                  : 'border-transparent bg-white hover:bg-slate-50'
              }`}
            >
              <div className="w-12 h-12 rounded-full border-2 border-white shadow-sm overflow-hidden bg-slate-100">
                   <img src={s.avatar} alt="Avatar" className="w-full h-full object-cover" />
              </div>
              <div>
                <div className="font-black text-slate-700 text-sm">{s.displayName.split(' ')[0]}</div>
                <div className="text-[10px] font-bold text-slate-500 flex items-center gap-1 mt-1">
                   {Math.floor(s.balance / 100)} GB • {s.balance % 100} MB
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Main Dashboard */}
        <div className="md:col-span-3">
           {activeKid ? (
             <div className="animate-fade-in space-y-6">
               
               {/* Kid Summary Header */}
               <div className="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-[2.5rem] p-6 text-white shadow-xl shadow-emerald-200 relative overflow-hidden">
                  <div className="relative z-10 flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl p-1 border-2 border-white/30 shrink-0">
                           <img src={activeKid.avatar} className="w-full h-full object-cover rounded-xl" />
                        </div>
                        <div>
                           <h2 className="text-2xl font-black">{activeKid.displayName}</h2>
                           <div className="flex flex-wrap gap-3 mt-2">
                              <span className="bg-white text-emerald-600 px-4 py-1.5 rounded-full text-sm font-black flex items-center gap-2 shadow-sm border-2 border-emerald-100">
                                <img src="https://i.ibb.co/kVhqQ0K9/gemabit.png" className="w-5 h-5 object-contain" />
                                {gemCount} GemaBits
                              </span>
                              <span className="bg-white/20 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 backdrop-blur-sm border border-white/30">
                                <img src="https://i.ibb.co/JWvYtPhJ/minibit-1.png" className="w-4 h-4 object-contain" /> {miniBitCount} MiniBits
                              </span>
                              <span className="bg-white/20 px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1 backdrop-blur-sm border border-white/30">
                                <Trophy size={14} className="text-orange-300" /> Racha: {activeKid.streakWeeks} Sem
                              </span>
                           </div>
                        </div>
                     </div>
                  </div>
                  <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-2xl"></div>
               </div>

               {/* WEEK SELECTOR */}
               <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm w-full md:w-auto self-start">
                   <div className="p-2 bg-slate-100 text-slate-500 rounded-xl"><Calendar size={20}/></div>
                   <div className="relative flex-1">
                       <select 
                          value={selectedWeek} 
                          onChange={(e) => setSelectedWeek(e.target.value)} 
                          className="w-full appearance-none bg-transparent font-black text-slate-700 text-sm focus:outline-none pr-8 cursor-pointer"
                       >
                           {availableWeeks.map(week => (
                               <option key={week.weekId} value={week.weekId}>
                                   Semana {week.weekId.split('-W')[1]} ({week.weekId === getCurrentWeekId() ? 'Actual' : getWeekDateRange(week.weekId)})
                               </option>
                           ))}
                       </select>
                       <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                   </div>
               </div>

               {/* Dual Column Layout */}
               <div className="grid md:grid-cols-2 gap-6">
                  
                  {/* HOME (Editable if current week) */}
                  <div className={`rounded-[2rem] p-6 border-2 shadow-sm relative overflow-hidden transition-colors ${isPastWeek ? 'bg-slate-50 border-slate-200' : 'bg-white border-slate-100'}`}>
                     <div className="flex items-center gap-3 mb-6 relative z-10">
                        <div className={`p-3 rounded-xl ${isPastWeek ? 'bg-slate-200 text-slate-500' : 'bg-emerald-100 text-emerald-600'}`}>
                           {isPastWeek ? <Lock size={24}/> : <Home size={24} strokeWidth={3} />}
                        </div>
                        <div>
                           <h3 className="font-black text-slate-700 text-lg">Misiones del Hogar</h3>
                           <p className="text-xs text-slate-400 font-bold">{isPastWeek ? 'Historial (Solo lectura)' : 'Toca para aprobar'}</p>
                        </div>
                     </div>
                     <TaskController 
                        studentId={activeKid.uid} 
                        allowedType="HOME" 
                        weekId={selectedWeek}
                        onUpdate={handleChildUpdate} 
                        readOnly={isPastWeek}
                     />
                  </div>

                  {/* SCHOOL (Always Read Only) */}
                  <div className="bg-slate-50 rounded-[2rem] p-6 border-2 border-slate-100 relative overflow-hidden">
                     <div className="flex items-center gap-3 mb-6 relative z-10">
                        <div className="p-3 bg-violet-100 text-violet-600 rounded-xl">
                           <School size={24} strokeWidth={3} />
                        </div>
                        <div>
                           <h3 className="font-black text-slate-700 text-lg">Progreso Escolar</h3>
                           <p className="text-xs text-slate-400 font-bold">Gestionado por la Maestra</p>
                        </div>
                     </div>
                     <TaskController 
                        studentId={activeKid.uid} 
                        allowedType="SCHOOL" 
                        readOnly={true} 
                        weekId={selectedWeek}
                     />
                  </div>

               </div>

               {/* TRANSACTION HISTORY SECTION */}
               <div className="bg-white rounded-[2rem] p-6 border-2 border-slate-100 shadow-sm">
                   <div className="flex items-center gap-3 mb-6">
                       <div className="p-3 bg-amber-100 text-amber-600 rounded-xl">
                           <History size={24} strokeWidth={3} />
                       </div>
                       <div>
                           <h3 className="font-black text-slate-700 text-lg">Historial de Movimientos</h3>
                           <p className="text-xs text-slate-400 font-bold">Ganancias (Escuela, Casa, Arcade) y Gastos</p>
                       </div>
                   </div>

                   {childTransactions.length === 0 ? (
                       <p className="text-center text-slate-400 font-bold text-xs py-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                           No hay movimientos registrados.
                       </p>
                   ) : (
                       <div className="space-y-3 max-h-80 overflow-y-auto pr-2">
                           {childTransactions.map((t) => {
                               const date = new Date(t.timestamp).toLocaleDateString();
                               const isEarn = t.type === 'EARN';
                               const visuals = getTransactionVisuals(t);

                               return (
                                   <div key={t.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100 hover:border-slate-200 transition-colors">
                                       <div className="flex items-center gap-3">
                                           <div className={`p-2.5 rounded-xl ${visuals.bg} ${visuals.text}`}>
                                               {visuals.icon}
                                           </div>
                                           <div>
                                               <p className="font-black text-slate-700 text-xs line-clamp-1">{translateDescription(t.description)}</p>
                                               <div className="flex items-center gap-2 mt-0.5">
                                                   <span className="text-[9px] font-bold text-slate-400 flex items-center gap-1">
                                                       <Calendar size={10}/> {date}
                                                   </span>
                                                   <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wide border ${visuals.bg} ${visuals.text} border-transparent bg-opacity-50`}>
                                                       {visuals.label}
                                                   </span>
                                               </div>
                                           </div>
                                       </div>
                                       <div className={`font-black text-sm flex items-center gap-1 ${isEarn ? 'text-emerald-500' : 'text-rose-500'}`}>
                                           {isEarn ? '+' : ''}{t.amount} MB
                                           {isEarn ? <ArrowUpCircle size={14}/> : <ArrowDownCircle size={14}/>}
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
                <div className="bg-white p-6 rounded-full shadow-sm mb-4">
                    <UserIcon size={48} className="text-slate-200" />
                </div>
                <span className="font-black text-lg">Selecciona un hijo</span>
                <p className="text-sm font-bold opacity-60">Para ver sus logros y asignar tareas</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};
