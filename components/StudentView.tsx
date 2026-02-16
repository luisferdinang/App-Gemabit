
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, TaskLog, Quiz, QuizResult, ExpenseRequest, SavingsGoal, ExpenseCategory, Transaction } from '../types';
import { supabaseService, getCurrentWeekId } from '../services/supabaseService';
import {
    X, TrendingUp, ArrowUpCircle, ArrowDownCircle, History, Calendar, Plus,
    ShoppingBag, PiggyBank, Wallet, CheckCircle2, Gamepad2, Trophy, Star,
    RefreshCw, Check, Diamond, QrCode, PlayCircle, Coins,
    Target, Mountain, Send, Clock, Pencil, ChevronDown, Lock,
    School, Home, Medal, PartyPopper, SmilePlus, Meh, Frown, Heart, Calculator
} from 'lucide-react';
import { soundService } from '../services/soundService';
import { STUDENT_AVATARS as AVATAR_OPTIONS } from './RoleSelector';
import { getWeekDateRange, getRelativeWeekNumber } from '../utils/dateUtils';
import { getGameTypeStyles } from '../utils/gameUtils';
import { getTaskVisuals } from '../utils/taskUtils';
import { SentenceGame } from './games/SentenceGame';
import { SortingGame } from './games/SortingGame';
import { SequenceGame } from './games/SequenceGame';
import { IntruderGame } from './games/IntruderGame';
import { useUserStore, UserState } from '../store/userStore';
import { PasswordChangeModal } from './PasswordChangeModal';

interface StudentViewProps {
    student: User; // Keeps receiving prop for initial load but uses store for updates
    refreshUser: () => void;
}

export const StudentView: React.FC<StudentViewProps> = ({ student: initialStudent, refreshUser }) => {
    // USE ZUSTAND STORE TO GET LIVE UPDATES
    const { currentUser: liveUser, exchangeRate, systemStartDate } = useUserStore((state: UserState) => ({
        currentUser: state.currentUser,
        exchangeRate: state.exchangeRate,
        systemStartDate: state.systemStartDate
    }));
    // Fallback to prop if store is empty (rare)
    const student = liveUser || initialStudent;

    const [tasks, setTasks] = useState<TaskLog[]>([]);
    const [isRefreshing, setIsRefreshing] = useState(false); // Estado para animación de carga manual

    // Quiz Arcade State
    const [showArcade, setShowArcade] = useState(false);
    const [availableQuizzes, setAvailableQuizzes] = useState<Quiz[]>([]);
    const [completedQuizzes, setCompletedQuizzes] = useState<QuizResult[]>([]);
    const [activeQuiz, setActiveQuiz] = useState<Quiz | null>(null);
    const [cashingOut, setCashingOut] = useState(false);

    // Expense Modal State
    const [showExpenseModal, setShowExpenseModal] = useState(false);
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseReason, setExpenseReason] = useState('');
    const [expenseCategory, setExpenseCategory] = useState<ExpenseCategory>('WANT');
    const [expenseCurrency, setExpenseCurrency] = useState<'MB' | 'USD' | 'VES'>('MB');
    const [expenseHistory, setExpenseHistory] = useState<ExpenseRequest[]>([]);
    const [submittingExpense, setSubmittingExpense] = useState(false);

    // Savings Goals State
    const [showGoalsModal, setShowGoalsModal] = useState(false);
    const [goals, setGoals] = useState<SavingsGoal[]>([]);
    const [newGoalTitle, setNewGoalTitle] = useState('');
    const [newGoalTarget, setNewGoalTarget] = useState('');
    const [isCreatingGoal, setIsCreatingGoal] = useState(false);
    const [editingGoalId, setEditingGoalId] = useState<string | null>(null);

    // Finance / "Mi Tesoro" State
    const [showFinanceModal, setShowFinanceModal] = useState(false);
    const [financeTransactions, setFinanceTransactions] = useState<Transaction[]>([]);
    const [financeTimeframe, setFinanceTimeframe] = useState<'DAY' | 'WEEK' | 'MONTH' | 'ALL'>('WEEK');

    // History Modal State
    const [showHistoryModal, setShowHistoryModal] = useState(false);
    const [studentWeeks, setStudentWeeks] = useState<{ weekId: string, completion: number }[]>([]);

    // Task View State
    const [selectedTaskWeek, setSelectedTaskWeek] = useState<string>(getCurrentWeekId());

    // Avatar Modal State
    const [showAvatarModal, setShowAvatarModal] = useState(false);

    // Password Change Modal State
    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [passwordModalMode, setPasswordModalMode] = useState<'self' | 'linked'>('self');
    const [passwordTargetUser, setPasswordTargetUser] = useState<{ id: string; name: string; role: 'ALUMNO' | 'PADRE' } | undefined>(undefined);
    const [linkedParents, setLinkedParents] = useState<User[]>([]);

    // Celebration State
    const [showCelebration, setShowCelebration] = useState(false);
    const [celebrationData, setCelebrationData] = useState<{ count: number, items: string[] }>({ count: 0, items: [] });
    const hasCheckedCelebration = useRef(false);

    // Super Gemabit Exchange State
    const [isExchangingSGB, setIsExchangingSGB] = useState(false);

    useEffect(() => {
        loadAllData();

        // Realtime Subscriptions for DATA (Profile handled in App.tsx via Zustand)
        // IMPORTANT: Listening to ANY change in 'tasks' for this student to trigger immediate update
        const tasksSub = supabaseService.subscribeToChanges('tasks', `student_id=eq.${student.uid}`, () => {
            console.log("🔔 Cambio detectado en Tareas - Recargando...");
            loadTasks();
            loadWeeksHistory();
            refreshUser(); // Forzar actualización de saldo en Zustand
            soundService.playPop(); // Sonido sutil para indicar actualización
        });

        const quizSub = supabaseService.subscribeToChanges('quiz_results', `student_id=eq.${student.uid}`, () => {
            loadQuizData();
            refreshUser();
        });

        const expensesSub = supabaseService.subscribeToChanges('expense_requests', `student_id=eq.${student.uid}`, () => {
            loadExpenses();
            refreshUser();
        });

        const goalsSub = supabaseService.subscribeToChanges('savings_goals', `student_id=eq.${student.uid}`, () => {
            loadGoals();
            refreshUser();
        });

        const transSub = supabaseService.subscribeToChanges('transactions', `student_id=eq.${student.uid}`, () => {
            loadFinanceData();
            refreshUser();
        });

        return () => {
            tasksSub.unsubscribe();
            quizSub.unsubscribe();
            expensesSub.unsubscribe();
            goalsSub.unsubscribe();
            transSub.unsubscribe();
        };
    }, [student.uid]);

    // RELOAD TASKS WHEN WEEK CHANGES
    useEffect(() => {
        loadTasks();
    }, [selectedTaskWeek]);

    const loadAllData = async () => {
        await Promise.all([
            loadTasks(),
            loadWeeksHistory(),
            loadQuizData(),
            loadExpenses(),
            loadGoals(),
            loadFinanceData(),
            loadLinkedParents()
        ]);
    };

    const handleManualRefresh = async () => {
        if (isRefreshing) return;
        setIsRefreshing(true);
        soundService.playPop();
        refreshUser(); // Update global user state (balance, xp)
        await loadAllData();
        setTimeout(() => setIsRefreshing(false), 800);
    };

    const loadTasks = async () => {
        const data = await supabaseService.getTasks(student.uid, selectedTaskWeek);
        setTasks(data);
        if (selectedTaskWeek === getCurrentWeekId()) {
            checkForCelebration(data);
        }
    };

    const loadWeeksHistory = async () => {
        const data = await supabaseService.getStudentWeeks(student.uid);
        // Ensure current week is in the list
        const current = getCurrentWeekId();
        if (!data.find(w => w.weekId === current)) {
            data.push({ weekId: current, completion: 0 });
        }
        data.sort((a, b) => b.weekId.localeCompare(a.weekId));
        setStudentWeeks(data);
    };

    const loadQuizData = async () => {
        const data = await supabaseService.getStudentQuizzes(student.uid);
        setAvailableQuizzes(data.available);
        setCompletedQuizzes(data.completed);
    };

    const loadExpenses = async () => {
        const ex = await supabaseService.getExpenseRequests(student.uid);
        setExpenseHistory(ex);
    };

    const loadGoals = async () => {
        const g = await supabaseService.getSavingsGoals(student.uid);
        setGoals(g);
    };

    const loadFinanceData = async () => {
        const t = await supabaseService.getTransactions(student.uid);
        setFinanceTransactions(t);
    };

    const loadLinkedParents = async () => {
        const parents = await supabaseService.getLinkedParents(student.uid);
        setLinkedParents(parents);
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

    const openArcade = () => {
        loadQuizData();
        setShowArcade(true);
    };

    const openExpenseModal = () => {
        loadExpenses();
        setExpenseAmount('');
        setExpenseCurrency('MB');
        setShowExpenseModal(true);
    };

    const openGoalsModal = () => {
        loadGoals();
        setShowGoalsModal(true);
    };

    const openFinanceModal = () => {
        loadFinanceData();
        setShowFinanceModal(true);
    };

    const openHistoryModal = () => {
        loadWeeksHistory();
        setShowHistoryModal(true);
    };

    // --- LOGIC FOR EXPENSE CONVERSION ---
    const calculateFinalMBAmount = () => {
        const raw = parseFloat(expenseAmount);
        if (isNaN(raw) || raw <= 0) return 0;

        if (expenseCurrency === 'MB') return Math.round(raw);

        // 100 MB = 1 USD
        if (expenseCurrency === 'USD') return Math.round(raw * 100);

        // MB = (Bs / Rate) * 100
        if (expenseCurrency === 'VES' && exchangeRate > 0) {
            const usdVal = raw / exchangeRate;
            return Math.round(usdVal * 100);
        }
        return 0;
    };

    const handleExpenseRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        const finalAmount = calculateFinalMBAmount();

        if (finalAmount <= 0 || !expenseReason.trim()) return;

        if (finalAmount > student.balance) {
            alert(`No tienes suficientes MiniBits. Necesitas ${finalAmount} MB.`);
            return;
        }

        setSubmittingExpense(true);

        // Append original currency info to description if not MB
        let finalDescription = expenseReason;
        if (expenseCurrency === 'USD') finalDescription += ` (Costo: $${expenseAmount})`;
        if (expenseCurrency === 'VES') finalDescription += ` (Costo: Bs.${expenseAmount})`;

        const result = await supabaseService.requestExpense(student.uid, finalAmount, finalDescription, expenseCategory);
        setSubmittingExpense(false);

        if (result.success) {
            setExpenseAmount('');
            setExpenseReason('');
            setExpenseCurrency('MB');
            alert("¡Solicitud enviada a tus padres!");
            loadExpenses();
        } else {
            alert("Error: " + result.error);
        }
    };

    const handleSaveGoal = async (e: React.FormEvent) => { e.preventDefault(); const amountGB = parseFloat(newGoalTarget); if (!amountGB || amountGB <= 0 || !newGoalTitle.trim()) return; setIsCreatingGoal(true); let result; if (editingGoalId) { result = await supabaseService.updateSavingsGoal(editingGoalId, newGoalTitle, Math.round(amountGB * 100)); } else { result = await supabaseService.createSavingsGoal(student.uid, newGoalTitle, Math.round(amountGB * 100)); } setIsCreatingGoal(false); if (result.success) { setNewGoalTitle(''); setNewGoalTarget(''); setEditingGoalId(null); loadGoals(); soundService.playSuccess(); } else { alert("Error: " + result.error); } };
    const startEditingGoal = (goal: SavingsGoal) => { setEditingGoalId(goal.id); setNewGoalTitle(goal.title); setNewGoalTarget((goal.targetAmount / 100).toString()); };
    const cancelEditing = () => { setEditingGoalId(null); setNewGoalTitle(''); setNewGoalTarget(''); };
    const handleDeleteGoal = async (goalId: string) => { if (confirm("¿Borrar esta meta?")) { await supabaseService.deleteGoal(goalId); loadGoals(); } };
    const handleSentiment = async (requestId: string, sentiment: 'HAPPY' | 'NEUTRAL' | 'SAD') => { await supabaseService.updateExpenseSentiment(requestId, sentiment); loadExpenses(); soundService.playPop(); };
    const handleExchangeSGB = async () => { if (student.streakWeeks < 4) return; if (!confirm("¿Quieres canjear tus 4 semanas de racha por 1 Super GemaBit (5 GemaBits)?")) return; setIsExchangingSGB(true); const result = await supabaseService.exchangeSuperGemabit(student.uid); setIsExchangingSGB(false); if (result.success) { soundService.playCelebration(); alert("¡FELICIDADES! 🎉\nHas recibido 5 GemaBits (500 MB)."); refreshUser(); } else { alert("Error: " + result.error); } };
    const checkForCelebration = (loadedTasks: TaskLog[]) => { if (hasCheckedCelebration.current) return; let totalEarnings = 0; let approvedItems: string[] = []; loadedTasks.forEach(task => { Object.entries(task.status).forEach(([key, completed]) => { if (completed) { const reward = task.type === 'SCHOOL' ? 20 : 25; totalEarnings += reward; if (approvedItems.length < 3) { const visuals = getTaskVisuals(key); approvedItems.push(visuals.label); } } }); }); if (totalEarnings > 0) { const weekId = getCurrentWeekId(); const storageKey = `gemabit_celebration_${student.uid}_${weekId}_${totalEarnings}`; if (localStorage.getItem(storageKey)) { hasCheckedCelebration.current = true; return; } soundService.playCelebration(); setCelebrationData({ count: totalEarnings, items: approvedItems.length < 3 ? approvedItems : [...approvedItems, '...y más!'] }); setShowCelebration(true); localStorage.setItem(storageKey, 'true'); } hasCheckedCelebration.current = true; };
    const handleQuizFail = async () => {
        if (!activeQuiz) return;
        soundService.playPop(); // Error sound or similar
        // Save result with 0 score (LOSS)
        await supabaseService.submitQuiz(student.uid, activeQuiz.id, activeQuiz.question, 0, 0); // 0 score, 0 earned
        alert("¡Oh no! 😢 Juego terminado. Mejor suerte la próxima vez.");
        setActiveQuiz(null);
        loadQuizData();
    };

    const handleTextAnswer = (index: number) => {
        if (!activeQuiz) return;
        if (index === activeQuiz.correctIndex) {
            handleQuizSuccess();
        } else {
            handleQuizFail(); // Trigger fail immediately
        }
    };

    const handleQuizSuccess = async () => {
        if (!activeQuiz) return;
        soundService.playCoin();
        await supabaseService.submitQuiz(student.uid, activeQuiz.id, activeQuiz.question, 100, activeQuiz.reward);
        alert(`¡Correcto! 🎉\nGanaste ${activeQuiz.reward} MB. Ahora está en tu bolsa.`);
        setActiveQuiz(null);
        loadQuizData();
    };

    const handleCashOut = async () => {
        if (bagBalance === 0) return;
        setCashingOut(true);
        const result = await supabaseService.cashOutQuizEarnings(student.uid);
        setCashingOut(false);
        if (result.success) {
            soundService.playCelebration();
            alert(`¡Cobrado! 💰\n+${bagBalance} MB añadidos a tu billetera.`);
            loadQuizData();
            refreshUser();
        } else {
            alert('Error: ' + result.error);
        }
    };

    const handleChangeAvatar = async (avatarUrl: string) => {
        const result = await supabaseService.updateAvatar(student.uid, avatarUrl);
        if (result.success) {
            soundService.playPop();
            setShowAvatarModal(false);
            refreshUser();
        } else {
            alert('Error: ' + result.error);
        }
    };

    const gems = Math.floor(student.balance / 100);
    const minibits = student.balance % 100;
    const streakPercent = Math.min((student.streakWeeks / 4) * 100, 100);

    // ... (Currency Calculations - unchanged) ...
    const balanceUSD = (student.balance / 100).toFixed(2);
    const balanceVES = exchangeRate > 0 ? ((student.balance / 100) * exchangeRate).toFixed(2) : '---';

    const { totalQuizEarnings, bagBalance, pendingQuizEarnings } = useMemo(() => {
        // Only count earnings from WINS (score > 0, implied by having earned > 0 usually, but checking status is safer if we had partials, but here 0 earned = 0)
        const total = completedQuizzes.filter(q => q.status === 'APPROVED').reduce((sum, q) => sum + q.earned, 0);
        const pending = completedQuizzes.filter(q => q.status === 'PENDING').reduce((sum, q) => sum + q.earned, 0);
        const inBag = completedQuizzes.filter(q => q.status === 'IN_BAG').reduce((sum, q) => sum + q.earned, 0);
        return { totalQuizEarnings: total, pendingQuizEarnings: pending, bagBalance: inBag };
    }, [completedQuizzes]);

    // ... (filteredTransactions, weeklyProgress - unchanged) ...
    const { filteredTransactions, totalEarned, totalSpent } = useMemo(() => { const now = new Date(); now.setHours(0, 0, 0, 0); const filtered = financeTransactions.filter(t => { const tDate = new Date(t.timestamp); tDate.setHours(0, 0, 0, 0); if (financeTimeframe === 'DAY') return tDate.getTime() === now.getTime(); if (financeTimeframe === 'WEEK') { const weekAgo = new Date(now); weekAgo.setDate(now.getDate() - 7); return tDate >= weekAgo; } if (financeTimeframe === 'MONTH') { const monthAgo = new Date(now); monthAgo.setDate(now.getDate() - 30); return tDate >= monthAgo; } return true; }); const earned = filtered.filter(t => t.type === 'EARN').reduce((sum, t) => sum + t.amount, 0); const spent = filtered.filter(t => t.type === 'SPEND').reduce((sum, t) => sum + Math.abs(t.amount), 0); return { filteredTransactions: filtered, totalEarned: earned, totalSpent: spent }; }, [financeTransactions, financeTimeframe]);
    const weeklyProgress = useMemo(() => { let totalTasks = 0; let completedTasks = 0; tasks.forEach(t => { totalTasks += Object.keys(t.status).length; completedTasks += Object.values(t.status).filter(Boolean).length; }); return totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0; }, [tasks]);

    const renderActiveGame = () => {
        if (!activeQuiz) return null;
        // Pass onFail to all games
        switch (activeQuiz.type) {
            case 'SENTENCE': return <SentenceGame quiz={activeQuiz} onComplete={handleQuizSuccess} onFail={handleQuizFail} />;
            case 'SORTING': return <SortingGame quiz={activeQuiz} onComplete={handleQuizSuccess} onFail={handleQuizFail} />;
            case 'SEQUENCE': return <SequenceGame quiz={activeQuiz} onComplete={handleQuizSuccess} onFail={handleQuizFail} />;
            case 'INTRUDER': return <IntruderGame quiz={activeQuiz} onComplete={handleQuizSuccess} onFail={handleQuizFail} />;
            case 'TEXT': default: return (<div className="space-y-3 mb-6"> {activeQuiz.options?.map((opt, idx) => (<button key={idx} onClick={() => handleTextAnswer(idx)} className="w-full text-left p-4 rounded-2xl border-4 border-slate-100 font-bold text-slate-600 hover:border-violet-500 hover:bg-violet-50 hover:text-violet-700 transition-all active:scale-95 text-lg" > {opt} </button>))} </div>);
        }
    };

    // ... (Existing variables: schoolTask, homeTask, isPastWeek, translateDescription) ...
    const schoolTask = tasks.find(t => t.type === 'SCHOOL');
    const homeTask = tasks.find(t => t.type === 'HOME');
    const isPastWeek = selectedTaskWeek !== getCurrentWeekId();

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
        <div className="space-y-8 animate-fade-in">
            {/* ... (Header, Info Cards, etc. - UNCHANGED) ... */}
            <div className="flex items-center justify-between gap-4 bg-white p-4 rounded-3xl border-b-4 border-slate-200 shadow-sm relative overflow-hidden">
                <div className="flex items-center gap-4 relative z-10">
                    <div className="relative group">
                        <div className="w-20 h-20 rounded-2xl bg-violet-50 border-4 border-violet-200 overflow-hidden shrink-0 relative z-10 animate-float cursor-pointer" onClick={() => setShowAvatarModal(true)}>
                            <img src={student.avatar} alt="Mi Avatar" className="w-full h-full object-cover" loading="eager" />
                        </div>
                        <button onClick={() => setShowAvatarModal(true)} className="absolute -bottom-2 -right-2 bg-white text-slate-500 p-1.5 rounded-full border-2 border-slate-200 shadow-sm z-20 hover:scale-110 transition-transform"> <Pencil size={14} /> </button>
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-slate-700 leading-none mb-1">¡Hola, {student.displayName.split(' ')[0]}!</h2>
                        <p className="text-slate-400 font-bold text-sm">Vamos a llenar la barra.</p>
                    </div>
                </div>

                {/* BOTÓN DE ACTUALIZAR MANUAL */}
                <div className="flex gap-2">
                    <button
                        onClick={() => openPasswordModal('self')}
                        className="relative z-20 bg-slate-100 hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 p-3 rounded-2xl border-2 border-slate-200 hover:border-indigo-200 transition-all active:scale-95"
                        title="Cambiar Contraseña"
                    >
                        <Lock size={24} strokeWidth={3} />
                    </button>
                    <button
                        onClick={handleManualRefresh}
                        disabled={isRefreshing}
                        className="relative z-20 bg-slate-100 hover:bg-violet-100 text-slate-400 hover:text-violet-600 p-3 rounded-2xl border-2 border-slate-200 hover:border-violet-200 transition-all active:scale-95"
                        title="Sincronizar Datos"
                    >
                        <RefreshCw size={24} className={isRefreshing ? 'animate-spin text-violet-500' : ''} strokeWidth={3} />
                    </button>
                </div>

                <div className="absolute right-0 top-0 w-32 h-32 bg-yellow-100 rounded-full blur-2xl opacity-60 translate-x-10 -translate-y-10 pointer-events-none"></div>
            </div>

            {student.linkCode && (<div className="bg-gradient-to-r from-orange-400 to-amber-500 rounded-3xl p-5 text-white shadow-lg flex items-center justify-between relative overflow-hidden group hover:scale-[1.02] transition-transform"> <div className="relative z-10"> <p className="font-bold text-orange-100 text-xs uppercase tracking-wider mb-1">Código de Vinculación</p> <div className="bg-white/20 px-4 py-2 rounded-xl inline-block backdrop-blur-sm border-2 border-white/30"> <p className="font-black text-3xl tracking-widest font-mono shadow-sm">{student.linkCode}</p> </div> <p className="text-xs font-bold text-orange-50 mt-2">Dáselo a tus papás</p> </div> <QrCode size={60} className="text-white/30 rotate-12 group-hover:rotate-0 transition-transform duration-500" /> <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div> </div>)}

            <div className="grid grid-cols-2 gap-4">
                {/* MI BILLETERA */}
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
                        {/* CURRENCY DISPLAY */}
                        <div className="mt-2 text-[10px] font-bold text-emerald-100 bg-black/10 px-2 py-1 rounded-lg inline-block">
                            ${balanceUSD} USD • Bs.{balanceVES}
                        </div>
                    </div>
                    <Diamond className="absolute -right-4 -bottom-4 text-emerald-300/40 rotate-12" size={100} />
                </div>

                {/* SUPER GEMABIT */}
                <div className="bg-violet-500 rounded-[2rem] p-5 text-white border-b-[6px] border-violet-700 relative overflow-hidden shadow-violet-200 shadow-xl active:translate-y-1 active:border-b-0 transition-all"> <div className="relative z-10"> <h3 className="font-bold text-violet-200 uppercase text-[10px] tracking-wider mb-1">Gana 1 Super GemaBit</h3> <div className="flex items-end gap-1 mb-2"> <span className="text-3xl font-black drop-shadow-md">{student.streakWeeks}</span> <span className="text-xs font-bold mb-1 opacity-80">/ 4 Semanas</span> </div> <div className="w-full bg-violet-900/40 h-4 rounded-full overflow-hidden border border-violet-400/30 relative"> <div className="absolute inset-0 bg-repeat-x opacity-20" style={{ backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,.15) 50%,rgba(255,255,255,.15) 75%,transparent 75%,transparent)', backgroundSize: '1rem 1rem' }}></div> <div className="bg-gradient-to-r from-yellow-300 to-yellow-500 h-full rounded-full shadow-sm" style={{ width: `${streakPercent}%` }}></div> </div> {student.streakWeeks >= 4 && (<button onClick={handleExchangeSGB} disabled={isExchangingSGB} className="mt-3 w-full bg-white text-violet-600 font-black text-xs py-2 rounded-xl shadow-lg border-b-4 border-violet-200 active:scale-95 active:border-b-0 transition-all animate-bounce-slow" > {isExchangingSGB ? '...' : '¡CANJEAR AHORA!'} </button>)} </div> <img src="https://i.ibb.co/Y9DqFjM/supergemabit.png" className="absolute -right-2 -bottom-2 w-24 h-24 object-contain opacity-40 rotate-12" /> </div>
            </div>

            <div className="grid grid-cols-1"> <button onClick={openFinanceModal} className="bg-amber-400 hover:bg-amber-300 active:translate-y-1 active:border-b-0 text-white rounded-[2rem] p-6 border-b-[6px] border-amber-600 flex flex-row items-center justify-between font-black transition-all shadow-lg shadow-amber-200 relative overflow-hidden group" > <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div> <div className="flex items-center gap-4 relative z-10"> <div className="bg-white/20 p-3 rounded-2xl group-hover:scale-110 transition-transform"> <TrendingUp size={32} strokeWidth={3} /> </div> <div className="text-left"> <span className="text-lg tracking-tight leading-none block">Mi Tesoro</span> <span className="text-[10px] font-bold opacity-80 uppercase tracking-widest">Mira lo que has ganado</span> </div> </div> <div className="relative z-10 bg-amber-700/20 px-3 py-1.5 rounded-lg flex items-center gap-2"> <Calendar size={20} className="opacity-70" /> </div> <TrendingUp className="absolute -right-6 -bottom-6 text-amber-900/20 rotate-12" size={120} /> </button> </div>

            <div className="grid grid-cols-2 gap-4">
                <button onClick={openArcade} className="bg-sky-500 hover:bg-sky-400 active:translate-y-1 active:border-b-0 text-white rounded-[2rem] p-4 border-b-[6px] border-sky-700 flex flex-col items-center justify-center gap-1 font-black transition-all shadow-lg shadow-sky-200 h-28 relative overflow-hidden group"> <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div> <> <div className="bg-white/20 p-2.5 rounded-full mb-1 group-hover:scale-110 transition-transform relative"> <Gamepad2 size={28} strokeWidth={3} /> {(pendingQuizEarnings > 0 || bagBalance > 0) && (<div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping"></div>)} </div> <span className="text-base tracking-tight leading-none flex items-center gap-1"> Zona Arcade <img src="https://i.ibb.co/JWvYtPhJ/minibit-1.png" className="w-4 h-4 object-contain inline" /> </span> </> </button>
                <button onClick={openExpenseModal} className="bg-rose-400 hover:bg-rose-300 active:translate-y-1 active:border-b-0 text-white rounded-[2rem] p-4 border-b-[6px] border-rose-600 flex flex-col items-center justify-center gap-1 font-black transition-all shadow-lg shadow-rose-200 h-28 group relative overflow-hidden"> <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div> <div className="bg-white/20 p-2.5 rounded-full mb-1 group-hover:scale-110 transition-transform"> <ShoppingBag size={28} strokeWidth={3} /> </div> <span className="text-base tracking-tight leading-none">Mis Gastos</span> </button>
            </div>

            <div className="grid grid-cols-1"> <button onClick={openGoalsModal} className="bg-indigo-500 hover:bg-indigo-400 active:translate-y-1 active:border-b-0 text-white rounded-[2rem] p-6 border-b-[6px] border-indigo-700 flex flex-row items-center justify-between font-black transition-all shadow-lg shadow-indigo-200 relative overflow-hidden group" > <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div> <div className="flex items-center gap-4 relative z-10"> <div className="bg-white/20 p-3 rounded-2xl group-hover:scale-110 transition-transform"> <Target size={32} strokeWidth={3} /> </div> <div className="text-left"> <span className="text-lg tracking-tight leading-none block">Mis Metas de Ahorro</span> <span className="text-[10px] font-bold opacity-80 uppercase tracking-widest">Guarda para tus sueños</span> </div> </div> <div className="relative z-10 bg-indigo-800/30 px-3 py-1.5 rounded-lg flex items-center gap-2"> <span className="text-2xl font-black">{goals.length}</span> <Mountain size={20} className="opacity-50" /> </div> <Mountain className="absolute -right-6 -bottom-6 text-indigo-900/20 rotate-12" size={120} /> </button> </div>

            {linkedParents.length > 0 && (
                <div className="bg-gradient-to-r from-pink-400 to-rose-500 rounded-[2rem] p-5 text-white shadow-lg border-b-[6px] border-rose-700 relative overflow-hidden">
                    {/* ... (Existing Parent Links) ... */}
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-3">
                            <Lock size={20} className="text-white/80" />
                            <h3 className="font-black text-white text-sm uppercase tracking-wider">Contraseñas de Familia</h3>
                        </div>
                        <p className="text-xs font-bold text-rose-100 mb-3">Puedes cambiar las contraseñas de tus padres</p>
                        <div className="space-y-2">
                            {linkedParents.map(parent => (
                                <button
                                    key={parent.uid}
                                    onClick={() => openPasswordModal('linked', parent)}
                                    className="w-full bg-white/20 hover:bg-white/30 backdrop-blur-sm border-2 border-white/30 rounded-xl p-3 flex items-center justify-between transition-all active:scale-95"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-white/20 flex items-center justify-center">
                                            <Lock size={18} />
                                        </div>
                                        <span className="font-bold text-sm">{parent.displayName}</span>
                                    </div>
                                    <div className="text-xs font-black bg-white/20 px-3 py-1 rounded-lg">
                                        Cambiar
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl"></div>
                </div>
            )}

            <div className="space-y-6">
                <div className="bg-slate-800 rounded-[2rem] p-6 text-white relative overflow-hidden shadow-lg border-b-4 border-slate-950">
                    <div className="relative z-10 flex justify-between items-end mb-2">
                        <div>
                            <h3 className="font-black text-xl flex items-center gap-2">
                                <Trophy className="text-yellow-400 fill-yellow-400 animate-bounce-slow" />
                                Misiones Semanales
                            </h3>
                            <div className="flex items-center gap-3">
                                <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mt-1">Completa todo para el Super GemaBit</p>
                                <button onClick={openHistoryModal} className="bg-slate-700 hover:bg-slate-600 text-xs font-bold px-2 py-1 rounded-lg flex items-center gap-1 transition-colors"><History size={12} /> Historial</button>
                            </div>
                        </div>
                        <span className="font-black text-3xl text-emerald-400">{Math.round(weeklyProgress)}%</span>
                    </div>
                    <div className="h-6 bg-slate-700 rounded-full border-2 border-slate-600 overflow-hidden relative">
                        <div className="h-full bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-500 transition-all duration-1000 ease-out relative" style={{ width: `${weeklyProgress}%` }} > <div className="absolute inset-0 bg-white/20 animate-pulse"></div> </div>
                    </div>
                </div>

                {/* WEEK SELECTOR */}
                <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-sm w-full md:w-auto self-start">
                    <div className="p-2 bg-slate-100 text-slate-500 rounded-xl"><Calendar size={20} /></div>
                    <div className="relative flex-1">
                        <select
                            value={selectedTaskWeek}
                            onChange={(e) => setSelectedTaskWeek(e.target.value)}
                            className="w-full appearance-none bg-transparent font-black text-slate-700 text-sm focus:outline-none pr-8 cursor-pointer"
                        >
                            {studentWeeks.map(week => (
                                <option key={week.weekId} value={week.weekId}>
                                    Semana {getRelativeWeekNumber(week.weekId, systemStartDate)} ({week.weekId === getCurrentWeekId() ? 'Actual' : getWeekDateRange(week.weekId)})
                                </option>
                            ))}
                        </select>
                        <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                    </div>
                </div>

                {tasks.length === 0 ? (
                    <p className="text-slate-400 font-bold text-center py-8">Cargando misiones...</p>
                ) : (
                    <div className="grid gap-8">
                        {schoolTask && (
                            <div key={schoolTask.id} className="relative">
                                {/* ... (School Tasks Rendering - Unchanged) ... */}
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 w-full px-4 text-center">
                                    <div className={`inline-flex items-center gap-2 border-b-4 text-white px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest shadow-lg ${isPastWeek ? 'bg-slate-400 border-slate-600' : 'bg-violet-500 border-violet-700'}`}>
                                        {isPastWeek ? <Lock size={14} /> : <School size={16} />} Misiones de Escuela
                                    </div>
                                    <div className="mt-1">
                                        <span className={`text-[10px] font-black px-3 py-0.5 rounded-full border ${isPastWeek ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-violet-100 text-violet-700 border-violet-200'}`}>
                                            {getWeekDateRange(schoolTask.weekId)}
                                        </span>
                                    </div>
                                </div>

                                <div className={`grid grid-cols-2 gap-3 pt-12 pb-6 px-4 rounded-[2.5rem] border-4 border-dashed ${isPastWeek ? 'bg-slate-50/50 border-slate-200' : 'bg-violet-50/50 border-violet-200'}`}>
                                    {Object.entries(schoolTask.status).map(([key, completed]) => {
                                        const visual = getTaskVisuals(key);
                                        return (
                                            <div key={key} className={` relative aspect-square rounded-3xl p-3 flex flex-col items-center justify-center text-center transition-all duration-300 group ${completed ? `${visual.color} shadow-lg scale-100 border-b-[6px]` : 'bg-white border-2 border-slate-200 text-slate-300 shadow-sm scale-95'} `}>
                                                <div className={` mb-2 p-2 rounded-2xl transition-transform duration-500 ${completed ? 'bg-white/20 rotate-0 scale-110 shadow-inner' : 'bg-slate-100 grayscale opacity-50 group-hover:scale-110'} `}>
                                                    {visual.icon}
                                                </div>
                                                <span className={` text-[10px] sm:text-xs font-black uppercase leading-tight ${completed ? 'opacity-100' : 'opacity-60'} `}>
                                                    {visual.label}
                                                </span>
                                                {completed && (<div className="absolute -top-2 -right-2 bg-white text-emerald-600 rounded-full p-1 border-2 border-emerald-100 shadow-sm animate-bounce-slow"> <CheckCircle2 size={16} strokeWidth={4} /> </div>)}
                                                {completed && !isPastWeek && (<div className="absolute -bottom-3 bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-0.5 rounded-full border-b-2 border-yellow-600 shadow-sm flex items-center gap-1"> +20 <img src="https://i.ibb.co/JWvYtPhJ/minibit-1.png" className="w-3 h-3 object-contain" /> </div>)}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {homeTask && (
                            <div key={homeTask.id} className="relative">
                                {/* ... (Home Tasks Rendering - Unchanged) ... */}
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-20 w-full px-4 text-center">
                                    <div className={`inline-flex items-center gap-2 border-b-4 text-white px-6 py-2 rounded-full font-black text-xs uppercase tracking-widest shadow-lg ${isPastWeek ? 'bg-slate-400 border-slate-600' : 'bg-emerald-500 border-emerald-700'}`}>
                                        {isPastWeek ? <Lock size={14} /> : <Home size={16} />} Misiones del Hogar
                                    </div>
                                    <div className="mt-1">
                                        <span className={`text-[10px] font-black px-3 py-0.5 rounded-full border ${isPastWeek ? 'bg-slate-100 text-slate-500 border-slate-200' : 'bg-emerald-100 text-emerald-700 border-emerald-200'}`}>
                                            {getWeekDateRange(homeTask.weekId)}
                                        </span>
                                    </div>
                                </div>

                                <div className={`grid grid-cols-2 gap-3 pt-12 pb-6 px-4 rounded-[2.5rem] border-4 border-dashed ${isPastWeek ? 'bg-slate-50/50 border-slate-200' : 'bg-emerald-50/50 border-emerald-200'}`}>
                                    {Object.entries(homeTask.status).map(([key, completed]) => {
                                        const visual = getTaskVisuals(key);
                                        return (
                                            <div key={key} className={` relative aspect-square rounded-3xl p-3 flex flex-col items-center justify-center text-center transition-all duration-300 group ${completed ? `${visual.color} shadow-lg scale-100 border-b-[6px]` : 'bg-white border-2 border-slate-200 text-slate-300 shadow-sm scale-95'} `}>
                                                <div className={` mb-2 p-2 rounded-2xl transition-transform duration-500 ${completed ? 'bg-white/20 rotate-0 scale-110 shadow-inner' : 'bg-slate-100 grayscale opacity-50 group-hover:scale-110'} `}>
                                                    {visual.icon}
                                                </div>
                                                <span className={` text-[10px] sm:text-xs font-black uppercase leading-tight ${completed ? 'opacity-100' : 'opacity-60'} `}>
                                                    {visual.label}
                                                </span>
                                                {completed && (<div className="absolute -top-2 -right-2 bg-white text-emerald-600 rounded-full p-1 border-2 border-emerald-100 shadow-sm animate-bounce-slow"> <CheckCircle2 size={16} strokeWidth={4} /> </div>)}
                                                {completed && !isPastWeek && (<div className="absolute -bottom-3 bg-yellow-400 text-yellow-900 text-[10px] font-black px-2 py-0.5 rounded-full border-b-2 border-yellow-600 shadow-sm flex items-center gap-1"> +25 <img src="https://i.ibb.co/JWvYtPhJ/minibit-1.png" className="w-3 h-3 object-contain" /> </div>)}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* FINANCE MODAL, HISTORY MODAL, ETC. (Keep existing modals) */}
            {/* ... (Finance Modal code - Unchanged) ... */}
            {showFinanceModal && (<div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fade-in"> <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl border-4 border-amber-300 relative overflow-hidden flex flex-col max-h-[90vh]"> <div className="bg-amber-400 p-6 text-center relative border-b-4 border-amber-500"> <button onClick={() => setShowFinanceModal(false)} className="absolute top-4 right-4 p-2 bg-amber-500 rounded-full text-white hover:bg-amber-600 transition-colors shadow-sm"> <X size={20} strokeWidth={3} /> </button> <div className="inline-block p-3 bg-white/20 rounded-2xl backdrop-blur-sm border-2 border-white/40 mb-2 shadow-inner"> <TrendingUp size={32} className="text-white drop-shadow-md" strokeWidth={3} /> </div> <h3 className="text-2xl font-black text-white drop-shadow-md tracking-tight">Mi Tesoro</h3> <p className="text-amber-50 text-xs font-bold mt-1 uppercase tracking-widest opacity-90">Tu Historia de Monedas</p> </div> <div className="p-6 overflow-y-auto bg-slate-50 flex-1"> <div className="flex justify-center mb-8"> <div className="bg-white p-1.5 rounded-2xl flex gap-1 shadow-sm border border-slate-100"> {['DAY', 'WEEK', 'MONTH', 'ALL'].map(t => (<button key={t} onClick={() => setFinanceTimeframe(t as any)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${financeTimeframe === t ? 'bg-amber-400 text-white shadow-md transform scale-105' : 'text-slate-400 hover:bg-slate-50'}`} > {t === 'DAY' ? 'Hoy' : t === 'WEEK' ? 'Semana' : t === 'MONTH' ? 'Mes' : 'Todo'} </button>))} </div> </div> <div className="bg-white rounded-3xl p-6 border-2 border-slate-100 shadow-sm mb-8 relative overflow-hidden"> <div className="absolute top-0 left-0 w-full h-2 bg-slate-100"></div> <div className="flex items-end justify-center gap-12 h-40 pt-4"> <div className="flex flex-col items-center gap-2 w-16 group relative"> <div className="absolute -top-8 bg-emerald-500 text-white text-xs font-black px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg mb-1 whitespace-nowrap z-10"> +{totalEarned} MB </div> <div className="w-full bg-emerald-50 rounded-t-2xl relative overflow-hidden flex items-end border-x-2 border-t-2 border-emerald-100 shadow-inner" style={{ height: '100%' }}> <div className="w-full bg-gradient-to-t from-emerald-400 to-emerald-300 relative transition-all duration-1000 ease-out" style={{ height: `${Math.max((totalEarned / Math.max(totalEarned, totalSpent, 1)) * 100, 5)}%` }} > <div className="absolute top-0 left-0 w-full h-1 bg-white/30"></div> </div> </div> <div className="bg-emerald-100 p-2.5 rounded-xl text-emerald-600 shadow-sm border border-emerald-200 z-10 -mt-4 bg-white"> <ArrowUpCircle size={24} strokeWidth={3} /> </div> <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider">Ganado</span> </div> <div className="flex flex-col items-center gap-2 w-16 group relative"> <div className="absolute -top-8 bg-rose-500 text-white text-xs font-black px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity shadow-lg mb-1 whitespace-nowrap z-10"> -{totalSpent} MB </div> <div className="w-full bg-rose-50 rounded-t-2xl relative overflow-hidden flex items-end border-x-2 border-t-2 border-rose-100 shadow-inner" style={{ height: '100%' }}> <div className="w-full bg-gradient-to-t from-rose-400 to-rose-300 relative transition-all duration-1000 ease-out" style={{ height: `${Math.max((totalSpent / Math.max(totalEarned, totalSpent, 1)) * 100, 5)}%` }} > <div className="absolute top-0 left-0 w-full h-1 bg-white/30"></div> </div> </div> <div className="bg-rose-100 p-2.5 rounded-xl text-rose-600 shadow-sm border border-rose-200 z-10 -mt-4 bg-white"> <ArrowDownCircle size={24} strokeWidth={3} /> </div> <span className="text-[10px] font-black text-rose-600 uppercase tracking-wider">Usado</span> </div> </div> </div> <h4 className="font-black text-slate-400 text-xs uppercase tracking-widest mb-4 pl-2 flex items-center gap-2"> <History size={14} /> Movimientos </h4> {filteredTransactions.length === 0 ? (<div className="flex flex-col items-center justify-center py-10 text-slate-300 bg-white border-4 border-dashed border-slate-100 rounded-3xl"> <div className="bg-slate-50 p-4 rounded-full mb-3"> <Calendar size={32} /> </div> <span className="font-black text-sm">Nada por aquí</span> <span className="text-xs font-bold opacity-60">¡Empieza a ganar monedas!</span> </div>) : (<div className="space-y-3 pb-4"> {filteredTransactions.map((t, idx) => { const isEarn = t.type === 'EARN'; let Icon = isEarn ? Plus : ShoppingBag; let colorClass = isEarn ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'; if (t.description.includes('Ahorro')) { Icon = PiggyBank; colorClass = 'bg-amber-100 text-amber-600'; } else if (t.description.includes('Retiro')) { Icon = Wallet; colorClass = 'bg-indigo-100 text-indigo-600'; } else if (t.description.includes('Tarea')) { Icon = CheckCircle2; colorClass = 'bg-violet-100 text-violet-600'; } else if (t.description.includes('Juego') || t.description.includes('Quiz')) { Icon = Gamepad2; colorClass = 'bg-sky-100 text-sky-600'; } return (<div key={t.id} className="bg-white p-3 rounded-2xl border-b-4 border-slate-100 shadow-sm flex items-center justify-between group hover:border-amber-200 transition-colors"> <div className="flex items-center gap-3"> <div className={`p-3 rounded-xl ${colorClass} group-hover:scale-110 transition-transform`}> <Icon size={18} strokeWidth={3} /> </div> <div> <p className="font-black text-slate-700 text-xs line-clamp-1">{translateDescription(t.description)}</p> <p className="text-[10px] font-bold text-slate-400">{new Date(t.timestamp).toLocaleDateString()}</p> </div> </div> <div className={`font-black text-base flex items-center gap-1 ${isEarn ? 'text-emerald-500' : 'text-rose-500'}`}> {isEarn ? '+' : '-'}{Math.abs(t.amount)} <img src="https://i.ibb.co/JWvYtPhJ/minibit-1.png" className="w-3.5 h-3.5 object-contain opacity-70" /> </div> </div>); })} </div>)} </div> </div> </div>)}

            {/* ARCADE MODAL - UPDATED */}
            {showArcade && (<div className="fixed inset-0 z-50 flex flex-col bg-slate-900/95 backdrop-blur-md animate-fade-in text-white p-4 overflow-y-auto"> <div className="flex justify-between items-center mb-6 sticky top-0 bg-slate-900/80 p-2 z-20 backdrop-blur-xl rounded-2xl border border-white/10"> <div className="flex items-center gap-3"> <div className="bg-sky-500 p-2 rounded-xl text-white"> <Gamepad2 size={24} /> </div> <div> <h2 className="text-xl font-black">Zona Arcade</h2> <div className="flex items-center gap-2 text-xs font-bold text-slate-400"> <span className="flex items-center gap-1"><img src="https://i.ibb.co/JWvYtPhJ/minibit-1.png" className="w-4 h-4" /> {minibits} MB</span> </div> </div> </div> <button onClick={() => { setShowArcade(false); setActiveQuiz(null); }} className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"> <X size={24} /> </button> </div> <div className="mb-8"> <div className="bg-gradient-to-r from-amber-400 to-orange-500 rounded-3xl p-6 border-4 border-amber-300 shadow-xl relative overflow-hidden flex flex-between items-center"> <div className="relative z-10"> <p className="text-amber-100 text-xs font-bold uppercase tracking-wider mb-1 flex items-center gap-2"> <Wallet size={16} /> Bolsa Actual </p> <span className="text-4xl font-black text-white flex items-center gap-2 drop-shadow-md"> {bagBalance} <span className="text-lg opacity-80">MB</span> </span> </div> <div className="relative z-20"> <button disabled={bagBalance === 0 || cashingOut} onClick={handleCashOut} className="bg-white text-orange-600 px-6 py-3 rounded-2xl font-black text-sm uppercase tracking-wider shadow-lg border-b-4 border-orange-200 active:translate-y-1 active:border-b-0 transition-all disabled:opacity-50 disabled:grayscale flex items-center gap-2" > {cashingOut ? <RefreshCw className="animate-spin" size={18} /> : <Send size={18} />} {bagBalance > 0 ? 'COBRAR' : 'VACÍA'} </button> </div> <Coins className="absolute -right-6 -bottom-6 text-white/20" size={100} /> </div> </div> {!activeQuiz ? (<div className="space-y-8 pb-12"> <div className="space-y-4"> <h3 className="text-lg font-black flex items-center gap-2 text-sky-400"> <PlayCircle size={20} /> Disponibles </h3> {availableQuizzes.length === 0 ? (<div className="bg-white/5 rounded-3xl p-8 text-center border-2 border-dashed border-white/10"> <div className="inline-block p-4 bg-white/5 rounded-full mb-3"> {completedQuizzes.length > 0 ? <CheckCircle2 className="text-emerald-400" size={32} /> : <PlayCircle className="text-slate-500" size={32} />} </div> <p className="font-bold text-slate-400"> ¡Todo completado! </p> <p className="text-xs text-slate-500"> Vuelve más tarde para nuevos desafíos. </p> </div>) : (availableQuizzes.map(quiz => {
                const visuals = getGameTypeStyles(quiz.type);
                // CHECK IF ALREADY PLAYED (WIN OR LOSS)
                const result = completedQuizzes.find(r => r.quizId === quiz.id);
                const isPlayed = !!result;
                const isFailed = result && result.score === 0;

                return (<button key={quiz.id} onClick={() => !isPlayed && setActiveQuiz(quiz)} disabled={isPlayed} className={`w-full text-left bg-white rounded-3xl p-5 relative overflow-hidden group shadow-lg flex gap-4 items-center transition-all ${isPlayed ? 'opacity-80 grayscale' : 'hover:scale-[1.02]'}`} > <div className={`w-16 h-16 rounded-2xl ${visuals.light} ${visuals.text} flex items-center justify-center shrink-0 border-2 ${visuals.border}`}> {visuals.icon} </div> <div className="relative z-10 flex-1"> <div className="flex justify-between items-start mb-1"> <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider ${visuals.light} ${visuals.text} border ${visuals.border}`}> {visuals.label} </span> <div className={`flex items-center gap-1 px-2 py-1 rounded-lg font-black text-xs shadow-sm ${isFailed ? 'bg-slate-200 text-slate-600' : isPlayed ? 'bg-emerald-400 text-white' : 'bg-yellow-400 text-yellow-900'}`}> {isFailed ? 'FALLIDO' : isPlayed ? 'COMPLETADO' : <><div className="w-2 h-2 rounded-full bg-yellow-900/50"></div> +{quiz.reward} MB</>} </div> </div> <h4 className="text-slate-800 font-black text-base leading-tight pr-2 line-clamp-2">{quiz.question}</h4> </div> <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-slate-100 to-transparent opacity-50"></div> </button>);
            }))} </div> {completedQuizzes.length > 0 && (<div className="space-y-4"> <div className="flex items-center justify-between"> <h3 className="text-lg font-black flex items-center gap-2 text-emerald-400"> <CheckCircle2 size={20} /> Historial </h3> <span className="text-xs font-bold text-slate-500 bg-white/10 px-2 py-1 rounded-lg"> Total Ganado: +{totalQuizEarnings + pendingQuizEarnings} MB </span> </div> <div className="space-y-3"> {completedQuizzes.map((result, idx) => { const isPending = result.status === 'PENDING'; const isInBag = result.status === 'IN_BAG'; const isApproved = result.status === 'APPROVED'; const isFailed = result.score === 0; return (<div key={idx} className={`rounded-2xl p-4 flex items-center justify-between border border-white/5 ${isFailed ? 'bg-red-500/10' : 'bg-slate-800/50'}`}> <div className="flex items-center gap-4"> <div className={`p-3 rounded-xl ${isApproved ? 'bg-emerald-500/20 text-emerald-400' : ''} ${isPending ? 'bg-amber-500/20 text-amber-400' : ''} ${isInBag ? 'bg-sky-500/20 text-sky-400' : ''} ${isFailed ? 'bg-red-500/20 text-red-400' : ''}`}> {isFailed ? <X size={20} /> : isApproved ? <CheckCircle2 size={20} /> : <Clock size={20} />} </div> <div> <p className="font-bold text-slate-200 text-sm line-clamp-1">{result.questionPreview}</p> <div className="flex items-center gap-2 mt-1"> <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${isApproved ? 'bg-emerald-500/10 text-emerald-300' : ''} ${isPending ? 'bg-amber-500/10 text-amber-300' : ''} ${isInBag ? 'bg-sky-500/10 text-sky-300' : ''} ${isFailed ? 'bg-red-500/10 text-red-300' : ''}`}> {isFailed && 'Fallido (0 PT)'} {isApproved && 'Cobrado'} {isPending && 'Enviado a Maestra'} {isInBag && 'En Bolsa (Sin cobrar)'} </span> </div> </div> </div> <div className={`font-black whitespace-nowrap flex items-center gap-1 ${isFailed ? 'text-slate-500 line-through opacity-50' : 'text-white'}`}> <img src="https://i.ibb.co/JWvYtPhJ/minibit-1.png" className="w-4 h-4 object-contain" /> +{result.earned} MB </div> </div>); })} </div> </div>)} </div>) : (<div className="flex flex-col h-full justify-center max-w-md mx-auto w-full"> <div className="bg-white rounded-[2.5rem] p-8 text-slate-800 shadow-2xl relative overflow-hidden"> <button onClick={() => setActiveQuiz(null)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 z-50"> <X size={20} /> </button> <div className="text-center mb-6"> {(() => { const visuals = getGameTypeStyles(activeQuiz.type); return (<> <div className={`inline-flex items-center gap-2 ${visuals.light} ${visuals.text} px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest border-2 ${visuals.border}`}> {visuals.icon} {visuals.label} </div> </>) })()} <h3 className="text-2xl font-black mt-4 leading-tight">{activeQuiz.question}</h3> </div> {renderActiveGame()} <div className="flex justify-center mt-6"> <div className="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-xl font-black text-sm flex items-center gap-2"> <div className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></div> Premio: {activeQuiz.reward} MB </div> </div> </div> </div>)} </div>)}

            {/* MODAL DE GASTOS CON CONVERSIÓN DE DIVISAS */}
            {showExpenseModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fade-in">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-md shadow-2xl border-4 border-white relative overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="bg-rose-500 p-6 text-center relative border-b-4 border-rose-600">
                            <button onClick={() => setShowExpenseModal(false)} className="absolute top-4 right-4 p-2 bg-rose-600 rounded-full text-rose-100 hover:bg-rose-700 transition-colors"> <X size={20} /> </button>
                            <div className="inline-block p-3 bg-white/20 rounded-2xl backdrop-blur-sm border-2 border-white/30 mb-2"> <ShoppingBag size={32} className="text-white" /> </div>
                            <h3 className="text-xl font-black text-white">Solicitar Gasto</h3>
                            <p className="text-rose-100 text-xs font-bold mt-1">Pide permiso a tus padres</p>
                        </div>
                        <div className="p-6 overflow-y-auto">
                            {/* SALDO ACTUAL */}
                            <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100 mb-6 flex justify-between items-center">
                                <span className="text-xs font-black text-slate-400 uppercase tracking-wider">Disponible</span>
                                <span className="text-xl font-black text-slate-700 flex items-center gap-1">
                                    <img src="https://i.ibb.co/JWvYtPhJ/minibit-1.png" className="w-5 h-5" /> {student.balance}
                                </span>
                            </div>

                            <form onSubmit={handleExpenseRequest} className="space-y-4 mb-8">

                                {/* SELECTOR DE MONEDA */}
                                <div className="flex gap-2 mb-2">
                                    {['MB', 'USD', 'VES'].map((curr) => (
                                        <button
                                            key={curr}
                                            type="button"
                                            onClick={() => setExpenseCurrency(curr as any)}
                                            className={`flex-1 py-2 rounded-xl text-[10px] font-black uppercase border-2 transition-all ${expenseCurrency === curr
                                                ? 'bg-slate-800 text-white border-slate-900 shadow-md'
                                                : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
                                                }`}
                                        >
                                            {curr === 'MB' ? 'MiniBits' : curr === 'USD' ? 'Dólares' : 'Bolívares'}
                                        </button>
                                    ))}
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 pl-2">
                                        Costo en {expenseCurrency === 'MB' ? 'MiniBits' : expenseCurrency === 'USD' ? 'Dólares ($)' : 'Bolívares (Bs)'}
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            step={expenseCurrency === 'MB' ? "1" : "0.01"}
                                            value={expenseAmount}
                                            onChange={e => setExpenseAmount(e.target.value)}
                                            placeholder="0"
                                            className="w-full bg-white border-2 border-slate-200 rounded-2xl p-4 font-black text-2xl text-slate-700 focus:border-rose-400 outline-none transition-all pr-12"
                                        />
                                        <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-300">
                                            {expenseCurrency}
                                        </span>
                                    </div>

                                    {/* CALCULADORA DE CONVERSIÓN VISUAL */}
                                    {expenseCurrency !== 'MB' && parseFloat(expenseAmount) > 0 && (
                                        <div className="mt-2 bg-slate-50 p-2 rounded-xl border border-slate-100 flex items-center justify-between text-xs font-bold text-slate-500 animate-fade-in">
                                            <span className="flex items-center gap-1"><Calculator size={14} /> Costo en Monedas:</span>
                                            <span className="text-rose-500 font-black text-sm flex items-center gap-1">
                                                {calculateFinalMBAmount()} MB <img src="https://i.ibb.co/JWvYtPhJ/minibit-1.png" className="w-3 h-3" />
                                            </span>
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 pl-2">¿En qué?</label>
                                    <input type="text" value={expenseReason} onChange={e => setExpenseReason(e.target.value)} placeholder="Ej. Helado, Juguete..." className="w-full bg-white border-2 border-slate-200 rounded-2xl p-4 font-bold text-sm text-slate-700 focus:border-rose-400 outline-none transition-all" />
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 pl-2">Tipo de Gasto</label>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button type="button" onClick={() => setExpenseCategory('NEED')} className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${expenseCategory === 'NEED' ? 'bg-emerald-100 border-emerald-400 text-emerald-700 scale-105 shadow-sm' : 'bg-white border-slate-200 text-slate-400 opacity-70'}`} > <Heart size={24} className={expenseCategory === 'NEED' ? 'fill-emerald-500' : ''} /> <span className="text-[10px] font-black uppercase">Lo Necesito</span> </button>
                                        <button type="button" onClick={() => setExpenseCategory('WANT')} className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${expenseCategory === 'WANT' ? 'bg-pink-100 border-pink-400 text-pink-700 scale-105 shadow-sm' : 'bg-white border-slate-200 text-slate-400 opacity-70'}`} > <Star size={24} className={expenseCategory === 'WANT' ? 'fill-pink-500' : ''} /> <span className="text-[10px] font-black uppercase">Lo Quiero</span> </button>
                                    </div>
                                </div>

                                <button disabled={submittingExpense || !expenseAmount || !expenseReason} className="w-full bg-rose-500 text-white font-black py-4 rounded-2xl border-b-[6px] border-rose-700 active:translate-y-1 active:border-b-0 transition-all uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-rose-100 disabled:opacity-50" > {submittingExpense ? <RefreshCw className="animate-spin" /> : 'Pedir Permiso'} </button>
                            </form>

                            {/* HISTORIAL */}
                            <div>
                                <h4 className="font-black text-slate-700 mb-3 flex items-center gap-2 text-sm"> <Clock size={16} className="text-slate-400" /> Historial de Solicitudes </h4>
                                {expenseHistory.length === 0 ? (<p className="text-center text-xs font-bold text-slate-400 py-4 bg-slate-50 rounded-xl border border-dashed border-slate-200">No hay solicitudes recientes.</p>) : (<div className="space-y-3"> {expenseHistory.map(req => (<div key={req.id} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex flex-col gap-2"> <div className="flex items-center justify-between"> <div> <p className="font-bold text-slate-700 text-xs">{req.description}</p> <div className="flex items-center gap-2 mt-1"> <span className={`text-[9px] font-black px-2 py-0.5 rounded-full uppercase ${req.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' : ''} ${req.status === 'PENDING' ? 'bg-amber-100 text-amber-700' : ''} ${req.status === 'REJECTED' ? 'bg-rose-100 text-rose-700' : ''} `}> {req.status === 'APPROVED' ? 'Aprobado' : req.status === 'PENDING' ? 'Esperando' : 'Rechazado'} </span> {req.category === 'NEED' && <Heart size={12} className="text-emerald-400 fill-emerald-400" />} {req.category === 'WANT' && <Star size={12} className="text-pink-400 fill-pink-400" />} </div> </div> <span className="font-black text-slate-800 text-sm">-{req.amount} MB</span> </div> {req.status === 'APPROVED' && (<div className="border-t border-slate-50 pt-2 flex items-center justify-between"> <span className="text-[9px] font-bold text-slate-400">¿Cómo te sientes?</span> <div className="flex gap-2"> <button onClick={() => handleSentiment(req.id, 'HAPPY')} className={`p-1 rounded-lg hover:bg-slate-50 transition-colors ${req.sentiment === 'HAPPY' ? 'scale-125 drop-shadow-sm' : req.sentiment ? 'opacity-30' : ''}`} > <SmilePlus size={18} className="text-emerald-500" /> </button> <button onClick={() => handleSentiment(req.id, 'NEUTRAL')} className={`p-1 rounded-lg hover:bg-slate-50 transition-colors ${req.sentiment === 'NEUTRAL' ? 'scale-125 drop-shadow-sm' : req.sentiment ? 'opacity-30' : ''}`} > <Meh size={18} className="text-amber-500" /> </button> <button onClick={() => handleSentiment(req.id, 'SAD')} className={`p-1 rounded-lg hover:bg-slate-50 transition-colors ${req.sentiment === 'SAD' ? 'scale-125 drop-shadow-sm' : req.sentiment ? 'opacity-30' : ''}`} > <Frown size={18} className="text-rose-500" /> </button> </div> </div>)} </div>))} </div>)}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {showGoalsModal && (<div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fade-in"> <div className="bg-indigo-900 rounded-[2.5rem] w-full max-w-md shadow-2xl border-4 border-indigo-500 relative overflow-hidden flex flex-col max-h-[90vh]"> <div className="bg-indigo-800 p-6 text-center relative border-b-4 border-indigo-950"> <button onClick={() => { setShowGoalsModal(false); cancelEditing(); }} className="absolute top-4 right-4 p-2 bg-indigo-900 rounded-full text-indigo-300 hover:text-white transition-colors border border-indigo-700"> <X size={20} /> </button> <div className="inline-block p-3 bg-indigo-500/20 rounded-2xl backdrop-blur-sm border-2 border-indigo-400/30 mb-2"> <Target size={32} className="text-indigo-200" /> </div> <h3 className="text-xl font-black text-white">Mis Metas</h3> <p className="text-indigo-200 text-xs font-bold mt-1">Visualiza tus objetivos de ahorro</p> </div> <div className="p-6 overflow-y-auto bg-indigo-900 flex-1"> <div className="bg-indigo-950/50 p-4 rounded-2xl border-2 border-indigo-800 mb-6"> <div className="flex justify-between items-center mb-3"> <h4 className="font-black text-indigo-200 text-xs uppercase tracking-widest">{editingGoalId ? 'Editar Meta' : 'Nueva Meta'}</h4> {editingGoalId && (<button onClick={cancelEditing} className="text-[10px] font-bold text-indigo-400 hover:text-white bg-indigo-900 px-2 py-1 rounded-lg">Cancelar</button>)} </div> <form onSubmit={handleSaveGoal} className="flex gap-2 items-end"> <div className="flex-1 space-y-2"> <input type="text" value={newGoalTitle} onChange={e => setNewGoalTitle(e.target.value)} placeholder="¿Qué quieres comprar?" className="w-full bg-indigo-900 border border-indigo-700 rounded-xl px-3 py-2 text-white placeholder-indigo-400 text-xs font-bold focus:border-indigo-400 outline-none" /> <div className="relative"> <input type="number" step="0.1" value={newGoalTarget} onChange={e => setNewGoalTarget(e.target.value)} placeholder="Precio" className="w-full bg-indigo-900 border border-indigo-700 rounded-xl px-3 py-2 text-white placeholder-indigo-400 text-xs font-bold focus:border-indigo-400 outline-none pr-8" /> <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-indigo-400 font-black">GB</span> </div> </div> <button disabled={isCreatingGoal || !newGoalTitle || !newGoalTarget} className={`h-full text-white p-3 rounded-xl border-b-4 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50 disabled:grayscale ${editingGoalId ? 'bg-amber-500 border-amber-700' : 'bg-emerald-500 border-emerald-700'}`} > {isCreatingGoal ? <RefreshCw className="animate-spin" size={20} /> : editingGoalId ? <Check size={20} strokeWidth={3} /> : <Plus size={20} strokeWidth={3} />} </button> </form> </div> <div className="space-y-4"> {goals.length === 0 ? (<div className="text-center text-indigo-400 text-xs font-bold py-8 border-2 border-dashed border-indigo-800 rounded-2xl"> No tienes metas de ahorro aún. </div>) : (goals.map(goal => { const progress = Math.min((student.balance / goal.targetAmount) * 100, 100); const isComplete = student.balance >= goal.targetAmount; const targetGB = (goal.targetAmount / 100).toFixed(1); const currentGB = (student.balance / 100).toFixed(1); const remaining = Math.max(0, (goal.targetAmount - student.balance) / 100).toFixed(1); return (<div key={goal.id} className={`bg-white rounded-2xl p-4 shadow-lg relative overflow-hidden group ${editingGoalId === goal.id ? 'ring-4 ring-amber-400' : ''}`}> {isComplete && (<div className="absolute inset-0 bg-emerald-500/90 z-20 flex flex-col items-center justify-center text-white animate-fade-in"> <PartyPopper size={40} className="animate-bounce mb-2" /> <span className="font-black text-lg uppercase tracking-widest">¡Meta Alcanzada!</span> <p className="text-xs mt-2 opacity-90">Ya tienes suficiente para tu objetivo</p> <button onClick={() => handleDeleteGoal(goal.id)} className="mt-4 bg-white text-emerald-600 px-4 py-2 rounded-xl font-bold text-xs shadow-sm hover:bg-emerald-50 transition-colors" > Marcar como Completada </button> </div>)} <div className="flex justify-between items-start mb-2"> <h4 className="font-black text-slate-800 text-lg">{goal.title}</h4> <div className="flex gap-1"> <button onClick={() => startEditingGoal(goal)} className="text-slate-300 hover:text-amber-500 p-1 bg-slate-50 rounded-lg"><Pencil size={14} /></button> <button onClick={() => handleDeleteGoal(goal.id)} className="text-slate-300 hover:text-red-400 p-1 bg-slate-50 rounded-lg"><X size={14} /></button> </div> </div> <div className="bg-slate-50 rounded-xl p-3 mb-3"> <div className="flex justify-between items-center mb-1"> <span className="text-[10px] font-black text-slate-400 uppercase">Tu Saldo Actual</span> <span className="text-sm font-black text-slate-700 flex items-center gap-1"><img src="https://i.ibb.co/kVhqQ0K9/gemabit.png" className="w-4 h-4" /> {currentGB} GB</span> </div> <div className="flex justify-between items-center"> <span className="text-[10px] font-black text-slate-400 uppercase">Meta</span> <span className="text-sm font-black text-indigo-600 flex items-center gap-1"><img src="https://i.ibb.co/kVhqQ0K9/gemabit.png" className="w-4 h-4" /> {targetGB} GB</span> </div> </div> <div className="h-6 bg-slate-100 rounded-full overflow-hidden mb-3 border-2 border-slate-200 relative"> <div className="h-full bg-gradient-to-r from-indigo-400 to-purple-500 transition-all duration-500 relative" style={{ width: `${progress}%` }} > <div className="absolute inset-0 bg-white/20 animate-pulse"></div> </div> <div className="absolute inset-0 flex items-center justify-center"> <span className="text-[10px] font-black text-slate-600 drop-shadow-sm">{Math.round(progress)}%</span> </div> </div> {!isComplete && (<div className="bg-amber-50 border-2 border-amber-200 rounded-xl p-2 text-center"> <p className="text-xs font-black text-amber-700">Te faltan <span className="text-amber-900">{remaining} GB</span> para tu meta 🎯</p> </div>)} {isComplete && (<div className="bg-emerald-50 border-2 border-emerald-200 rounded-xl p-2 text-center"> <p className="text-xs font-black text-emerald-700">¡Ya alcanzaste tu meta! 🎉</p> </div>)} </div>); }))} </div> </div> </div> </div>)}
            {showAvatarModal && (<div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in"> <div className="bg-white rounded-[2.5rem] p-8 w-full max-w-sm shadow-2xl border-4 border-white"> <div className="text-center mb-6"> <h3 className="text-xl font-black text-slate-800">Elige tu Mascota</h3> <p className="text-xs font-bold text-slate-400 uppercase mt-1">¿Quién eres hoy?</p> </div> <div className="grid grid-cols-4 gap-3 mb-6"> {AVATAR_OPTIONS.map(opt => (<button key={opt.url} onClick={() => handleChangeAvatar(opt.url)} className={`rounded-2xl border-4 transition-all relative overflow-hidden aspect-square hover:scale-105 active:scale-95 ${student.avatar === opt.url ? 'border-violet-500 shadow-lg scale-110 bg-violet-50 z-10' : 'border-slate-100 hover:border-violet-200'}`} > <img src={opt.url} className="w-full h-full object-cover" alt={opt.name} /> </button>))} </div> <button onClick={() => setShowAvatarModal(false)} className="w-full py-4 bg-slate-100 hover:bg-slate-200 text-slate-500 font-black rounded-2xl transition-colors" > Cancelar </button> </div> </div>)}
            {showCelebration && (<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm animate-fade-in"> <div className="absolute inset-0 overflow-hidden pointer-events-none"> <div className="absolute top-1/4 left-1/4 w-3 h-3 bg-yellow-400 rounded-full animate-ping"></div> <div className="absolute top-1/3 right-1/4 w-4 h-4 bg-emerald-400 rounded-full animate-bounce"></div> <div className="absolute bottom-1/3 left-1/3 w-2 h-2 bg-rose-400 rounded-full animate-ping delay-75"></div> <div className="absolute top-10 right-10 w-6 h-6 bg-violet-400 rotate-45 animate-pulse"></div> </div> <div className="bg-white w-full max-w-sm rounded-[3rem] p-8 text-center relative overflow-hidden shadow-2xl border-4 border-white animate-bounce-slow"> <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-r from-emerald-100 to-yellow-100 rounded-full blur-3xl opacity-50 animate-spin-slow pointer-events-none"></div> <div className="relative z-10"> <div className="inline-block p-4 bg-yellow-100 text-yellow-500 rounded-full mb-4 shadow-sm animate-bounce"> <PartyPopper size={48} strokeWidth={3} /> </div> <h2 className="text-3xl font-black text-slate-800 mb-2 tracking-tight">¡Misión Cumplida!</h2> <p className="text-slate-500 font-bold mb-6 text-sm">Tus padres y maestra aprobaron:</p> <div className="flex flex-wrap gap-2 justify-center mb-6"> {celebrationData.items.map((item, i) => (<span key={i} className="bg-slate-100 border-2 border-slate-200 px-3 py-1 rounded-xl text-xs font-black text-slate-600 capitalize"> {item} </span>))} </div> <div className="bg-slate-900 text-white rounded-3xl p-6 mb-6 shadow-xl relative overflow-hidden group"> <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-emerald-600 opacity-20 group-hover:opacity-30 transition-opacity"></div> <p className="text-emerald-300 text-xs font-black uppercase tracking-widest mb-1">Has Ganado</p> <div className="flex items-center justify-center gap-2"> <span className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-500 drop-shadow-sm"> +{celebrationData.count} </span> <span className="text-xl font-bold">MB</span> </div> {celebrationData.count >= 100 && (<div className="mt-2 bg-white/10 rounded-lg py-1 px-3 inline-flex items-center gap-2"> <img src="https://i.ibb.co/kVhqQ0K9/gemabit.png" className="w-4 h-4 object-contain animate-pulse" /> <span className="text-xs font-bold text-white">¡Eso es +{Math.floor(celebrationData.count / 100)} GemaBit!</span> </div>)} </div> <button onClick={() => setShowCelebration(false)} className="w-full bg-emerald-500 hover:bg-emerald-400 text-white font-black py-4 rounded-2xl border-b-[6px] border-emerald-700 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-widest text-lg shadow-lg shadow-emerald-200" > ¡Recoger Premio! </button> </div> </div> </div>)}

            <PasswordChangeModal
                isOpen={showPasswordModal}
                onClose={() => setShowPasswordModal(false)}
                mode={passwordModalMode}
                targetUser={passwordTargetUser}
                currentUserId={student.uid}
                currentUserRole="ALUMNO"
                onSuccess={() => {
                    soundService.playSuccess();
                    loadLinkedParents();
                }}
            />
        </div>
    );
};
