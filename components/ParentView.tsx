
import React, { useState, useEffect } from 'react';
import { User, ExpenseRequest, Transaction } from '../types';
import { supabaseService, getCurrentWeekId } from '../services/supabaseService';
import { TaskController } from './TaskController';
import { User as UserIcon, Link as LinkIcon, School, Home, Coins, Trophy, AlertTriangle, Check, X, History, TrendingDown, Calendar, Gamepad2, ArrowUpCircle, ArrowDownCircle, Sparkles, ChevronDown, Lock, RefreshCw, CheckCircle2, Loader2, HelpCircle } from 'lucide-react';
import { getWeekDateRange, getRelativeWeekNumber } from '../utils/dateUtils';
import { soundService } from '../services/soundService';
import { useUserStore } from '../store/userStore';
import { PasswordChangeModal } from './PasswordChangeModal';

interface ParentViewProps {
    currentUser: User;
}

export const ParentView: React.FC<ParentViewProps> = ({ currentUser }) => {
    const { exchangeRate } = useUserStore(); // Acceder a la tasa de cambio global
    const [children, setChildren] = useState<User[]>([]);
    const [selectedChild, setSelectedChild] = useState<string | null>(null);
    const [isLinking, setIsLinking] = useState(false);
    const [linkCode, setLinkCode] = useState('');

    // Refresh and Approval States
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [successId, setSuccessId] = useState<string | null>(null);
    const [confirmingRequest, setConfirmingRequest] = useState<ExpenseRequest | null>(null);

    // Expenses & Transactions State
    const [pendingExpenses, setPendingExpenses] = useState<ExpenseRequest[]>([]);
    const [childTransactions, setChildTransactions] = useState<Transaction[]>([]);

    // Week Navigation State
    const [availableWeeks, setAvailableWeeks] = useState<{ weekId: string, completion: number }[]>([]);
    const [selectedWeek, setSelectedWeek] = useState<string>(getCurrentWeekId());
    const [systemStartDate, setSystemStartDate] = useState<string | null>(null);

    // Password Change Modal State
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordModalMode, setPasswordModalMode] = useState<'self' | 'linked'>('self');
    const [passwordTargetUser, setPasswordTargetUser] = useState<{ id: string; name: string; role: 'ALUMNO' | 'PADRE' } | undefined>(undefined);

    // 1. Carga inicial y suscripciones en tiempo real
    useEffect(() => {
        loadParentData();

        // Cargar fecha de inicio del sistema
        const loadSystemStart = async () => {
            const startWeek = await supabaseService.getSystemStartWeekId();
            setSystemStartDate(startWeek);
        };
        loadSystemStart();

        const subParent = supabaseService.subscribeToChanges('profiles', `id=eq.${currentUser.uid}`, () => { loadParentData(); });

        // Escuchamos cambios en solicitudes de gasto
        const subExpenses = supabaseService.subscribeToChanges('expense_requests', undefined, () => {
            // Solo recargamos si no hay un proceso crítico de UI ocurriendo
            if (!successId && !processingId && !confirmingRequest) {
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
    }, [currentUser.uid, selectedChild, processingId, successId, confirmingRequest]);

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
            // SEGURIDAD: Nunca mostramos una que acabamos de aprobar exitosamente
            setPendingExpenses(expenses.filter(e => e.id !== successId));
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

    // --- FLUJO DE APROBACIÓN MEJORADO ---

    const handleApproveClick = (req: ExpenseRequest) => {
        setConfirmingRequest(req); // Abre el modal de "¿Estás seguro?"
    };

    const executeApproval = async () => {
        if (!confirmingRequest || processingId) return;

        const targetId = confirmingRequest.id;
        setProcessingId(targetId);
        setConfirmingRequest(null); // Cerramos el modal de pregunta

        try {
            const result = await supabaseService.approveExpense(targetId);
            if (result && result.success) {
                soundService.playSuccess();
                setSuccessId(targetId); // Disparamos el cartel de "¡APROBADO!"

                // Eliminación optimista inmediata del estado local para que desaparezca YA
                setPendingExpenses(prev => prev.filter(e => e.id !== targetId));

                // Esperamos 2 segundos para que el padre vea el feedback y luego limpiamos todo
                setTimeout(() => {
                    setSuccessId(null);
                    setProcessingId(null);
                    loadParentData(); // Recarga real para actualizar saldos de la barra lateral
                }, 2500);
            } else {
                alert("Error: " + (result?.error || "No se pudo procesar"));
                setProcessingId(null);
            }
        } catch (e) {
            console.error(e);
            alert("Error de conexión. Inténtalo de nuevo.");
            setProcessingId(null);
        }
    };

    const handleRejectExpense = async (id: string) => {
        if (processingId) return;
        setProcessingId(id);
        try {
            await supabaseService.rejectExpense(id);
            soundService.playPop();
            setPendingExpenses(prev => prev.filter(e => e.id !== id));
            setProcessingId(null);
            setTimeout(() => loadParentData(), 500);
        } catch (e) {
            alert("Error al rechazar");
            setProcessingId(null);
        }
    };

    const openPasswordModal = (mode: 'self' | 'linked', targetUser?: User) => {
        setPasswordModalMode(mode);
        if (mode === 'linked' && targetUser) {
            setPasswordTargetUser({
                id: targetUser.uid,
                name: targetUser.displayName,
                role: targetUser.role as 'ALUMNO' | 'PADRE'
            });
        } else {
            setPasswordTargetUser(undefined);
        }
        setShowPasswordModal(true);
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

    // CURRENCY CALCULATION FOR PARENTS
    const balanceUSD = activeKid ? (activeKid.balance / 100).toFixed(2) : '0.00';
    const balanceVES = activeKid && exchangeRate > 0 ? ((activeKid.balance / 100) * exchangeRate).toFixed(2) : '---';

    const getTransactionVisuals = (t: Transaction) => {
        const desc = t.description.toUpperCase();
        const isEarn = t.type === 'EARN';
        if (!isEarn) {
            if (desc.includes('AHORRO')) return { icon: <Coins size={18} />, bg: 'bg-indigo-100', text: 'text-indigo-600', label: 'Ahorro' };
            return { icon: <TrendingDown size={18} />, bg: 'bg-rose-100', text: 'text-rose-600', label: 'Gasto' };
        }
        if (desc.includes('QUIZ') || desc.includes('JUEGO')) return { icon: <Gamepad2 size={18} />, bg: 'bg-sky-100', text: 'text-sky-600', label: 'Arcade' };
        if (desc.includes('SCHOOL') || desc.includes('ASISTENCIA')) return { icon: <School size={18} />, bg: 'bg-violet-100', text: 'text-violet-600', label: 'Escuela' };
        if (desc.includes('HOME') || desc.includes('HOGAR')) return { icon: <Home size={18} />, bg: 'bg-emerald-100', text: 'text-emerald-600', label: 'Casa' };
        return { icon: <Sparkles size={18} />, bg: 'bg-amber-100', text: 'text-amber-600', label: 'Premio' };
    };

    return (
        <div className="animate-fade-in pb-10">

            {/* MODAL DE PREGUNTA: "¿ESTÁS SEGURO?" */}
            {confirmingRequest && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-fade-in">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-8 shadow-2xl border-4 border-white text-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500"></div>
                        <div className="w-20 h-20 rounded-3xl bg-emerald-50 text-emerald-500 flex items-center justify-center mx-auto mb-6 border-2 border-emerald-100 shadow-inner">
                            <HelpCircle size={48} strokeWidth={2.5} />
                        </div>
                        <h3 className="text-2xl font-black text-slate-800 mb-2">¿Aprobar Gasto?</h3>
                        <p className="text-slate-500 font-bold text-sm mb-8 leading-relaxed px-2">
                            ¿Confirmas que <b>{confirmingRequest.studentName}</b> puede usar <span className="text-rose-500 font-black">{confirmingRequest.amount} MiniBits</span> para su compra?
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setConfirmingRequest(null)}
                                className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl hover:bg-slate-200 transition-all active:scale-95"
                            >
                                No, cancelar
                            </button>
                            <button
                                onClick={executeApproval}
                                className="flex-1 py-4 bg-emerald-500 text-white font-black rounded-2xl shadow-lg border-b-[6px] border-emerald-700 active:border-b-0 active:translate-y-1 transition-all"
                            >
                                SÍ, APROBAR
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-slate-800">Panel de Padres</h2>
                <div className="flex gap-2">
                    <button onClick={() => openPasswordModal('self')} className="bg-white text-slate-400 hover:text-indigo-500 p-2.5 rounded-xl border-2 border-slate-100 hover:border-indigo-100 transition-all active:scale-95 shadow-sm">
                        <Lock size={20} />
                    </button>
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
                        <AlertTriangle className="text-rose-500" size={20} /> Solicitudes por Autorizar
                    </h3>
                    <div className="grid gap-4 md:grid-cols-2">
                        {pendingExpenses.map(req => {
                            const isProcessing = processingId === req.id;
                            const isSuccess = successId === req.id;

                            return (
                                <div key={req.id} className={`bg-white p-4 rounded-2xl shadow-sm flex items-center justify-between border-2 transition-all relative overflow-hidden ${isSuccess ? 'border-emerald-500 bg-emerald-50 scale-95 opacity-50' : 'border-rose-100'}`}>

                                    {/* OVERLAY DE CONFIRMACIÓN FINAL (¡APROBADO!) */}
                                    {isSuccess && (
                                        <div className="absolute inset-0 z-30 bg-emerald-500 flex flex-col items-center justify-center text-white animate-fade-in">
                                            <CheckCircle2 size={44} className="animate-bounce" />
                                            <span className="font-black text-base mt-2 uppercase tracking-widest shadow-sm">¡GASTO APROBADO!</span>
                                        </div>
                                    )}

                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden shrink-0 border-2 border-slate-50 shadow-sm">
                                            <img src={req.studentAvatar} className="w-full h-full object-cover" alt="Avatar" />
                                        </div>
                                        <div className="max-w-[140px]">
                                            <p className="font-black text-slate-800 text-sm truncate">{req.studentName}</p>
                                            <p className="text-slate-500 text-[10px] font-bold truncate">Desea: <span className="text-slate-700">{req.description}</span></p>
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
                                                disabled={!!processingId || !!successId}
                                                onClick={() => handleApproveClick(req)}
                                                className={`p-2.5 rounded-xl shadow-sm transition-all border-b-4 ${isProcessing ? 'bg-slate-100 border-slate-200' : 'bg-emerald-500 border-emerald-700 text-white hover:bg-emerald-600 active:translate-y-1 active:border-b-0'}`}
                                                title="Aprobar"
                                            >
                                                {isProcessing ? <Loader2 size={18} className="animate-spin text-slate-400" /> : <Check size={20} strokeWidth={4} />}
                                            </button>
                                            <button
                                                disabled={!!processingId || !!successId}
                                                onClick={() => handleRejectExpense(req.id)}
                                                className={`p-2.5 rounded-xl shadow-sm transition-all border-b-4 ${isProcessing ? 'bg-slate-50 border-slate-100' : 'bg-slate-200 border-slate-400 text-slate-500 hover:bg-slate-300 active:translate-y-1 active:border-b-0'}`}
                                                title="Rechazar"
                                            >
                                                <X size={20} strokeWidth={4} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {children.length > 0 && (
                <div className="mb-8 bg-gradient-to-r from-indigo-400 to-purple-500 rounded-[2.5rem] p-6 text-white shadow-lg border-b-[6px] border-purple-700 relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                            <Lock size={22} className="text-white/80" />
                            <h3 className="font-black text-white text-lg uppercase tracking-wider">Contraseñas de Familia</h3>
                        </div>
                        <p className="text-sm font-bold text-indigo-100 mb-4">Gestiona las contraseñas de tus hijos</p>
                        <div className="grid gap-3 md:grid-cols-2">
                            {children.map(child => (
                                <button
                                    key={child.uid}
                                    onClick={() => openPasswordModal('linked', child)}
                                    className="bg-white/20 hover:bg-white/30 backdrop-blur-sm border-2 border-white/30 rounded-2xl p-4 flex items-center justify-between transition-all active:scale-95"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-12 h-12 rounded-xl bg-white/20 overflow-hidden border-2 border-white/30">
                                            <img src={child.avatar} className="w-full h-full object-cover" alt={child.displayName} />
                                        </div>
                                        <div className="text-left">
                                            <span className="font-bold text-sm block">{child.displayName}</span>
                                            <span className="text-xs font-bold text-white/70">Cambiar contraseña</span>
                                        </div>
                                    </div>
                                    <div className="text-xs font-black bg-white/20 px-4 py-2 rounded-xl">
                                        <Lock size={16} />
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                </div>
            )}

            <div className="grid md:grid-cols-4 gap-6">
                {/* Sidebar Hijos */}
                <div className="md:col-span-1 space-y-3">
                    <h3 className="font-bold text-slate-400 text-[10px] uppercase tracking-widest mb-2 pl-2">Mis Hijos</h3>
                    {children.length === 0 && (
                        <div className="p-6 bg-slate-50 rounded-3xl text-slate-400 text-sm font-bold text-center border-2 border-dashed border-slate-200 opacity-60">
                            <UserIcon size={32} className="mx-auto mb-2 opacity-50" /> No hay vinculados.
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

                                        {/* PARENT VIEW CURRENCY CONVERSION DISPLAY */}
                                        <div className="mt-3 inline-block">
                                            <span className="text-[10px] font-black text-emerald-100 bg-black/20 px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
                                                Valor Real: <span className="text-white">${balanceUSD} USD</span> • <span className="text-white">Bs.{balanceVES}</span>
                                            </span>
                                        </div>

                                    </div>
                                </div>
                                <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
                            </div>

                            {/* Seleccion de Semana */}
                            <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm w-fit">
                                <div className="p-2 bg-slate-50 text-slate-400 rounded-xl"><Calendar size={18} /></div>
                                <div className="relative pr-6">
                                    <select value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)} className="appearance-none bg-transparent font-black text-slate-700 text-sm focus:outline-none cursor-pointer">
                                        {availableWeeks.map(week => (<option key={week.weekId} value={week.weekId}>Semana {systemStartDate ? getRelativeWeekNumber(week.weekId, systemStartDate) : week.weekId.split('-W')[1]} ({week.weekId === getCurrentWeekId() ? 'Actual' : getWeekDateRange(week.weekId)})</option>))}
                                    </select>
                                    <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={14} />
                                </div>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                {/* Tareas del Hogar */}
                                <div className={`rounded-[2rem] p-6 border-2 shadow-sm relative overflow-hidden transition-colors ${isPastWeek ? 'bg-slate-50 border-slate-200 opacity-80' : 'bg-white border-slate-100'}`}>
                                    <div className="flex items-center gap-3 mb-6 relative z-10">
                                        <div className={`p-3 rounded-xl ${isPastWeek ? 'bg-slate-200 text-slate-500' : 'bg-emerald-100 text-emerald-600'}`}>
                                            {isPastWeek ? <Lock size={20} /> : <Home size={20} strokeWidth={3} />}
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

            <PasswordChangeModal
                isOpen={showPasswordModal}
                onClose={() => setShowPasswordModal(false)}
                mode={passwordModalMode}
                targetUser={passwordTargetUser}
                currentUserId={currentUser.uid}
                currentUserRole="PADRE"
                onSuccess={() => {
                    soundService.playSuccess();
                    loadParentData();
                }}
            />
        </div>
    );
};
