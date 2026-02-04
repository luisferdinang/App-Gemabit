
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, StudentReport, QuizType, QuizResult, Quiz, ExpenseRequest } from '../types';
import { supabaseService, getCurrentWeekId } from '../services/supabaseService';
import { TaskController } from './TaskController';
import { 
  User as UserIcon, Check, X, ShieldAlert, BarChart3, Plus, BrainCircuit, School, 
  Home, Trophy, Gamepad2, RefreshCw, Lock, ShieldCheck, KeyRound, UserPlus, 
  Settings, Trash2, Calendar, ChevronDown, CheckCircle2, Clock, 
  MessageCircleQuestion, Puzzle, Layers, ListOrdered, Projector, 
  PartyPopper, Lightbulb, ArrowRight, ArrowLeft, Star, ShoppingBag, 
  Smartphone, Repeat, PiggyBank, TrendingUp, Wallet, LayoutGrid, Timer, 
  Camera, Upload, Search, Download, AlertTriangle, Database, Terminal, Copy, ExternalLink,
  Crown, GraduationCap, Medal, Sparkles, Key, Ghost, TriangleAlert, TrendingDown,
  Heart, SmilePlus, Meh, Frown
} from 'lucide-react';
import { soundService } from '../services/soundService';
import { getWeekDateRange } from '../utils/dateUtils';
import { getGameVisual } from '../utils/gameUtils';

interface TeacherViewProps {
  currentUser: User;
  refreshUser: () => void;
}

export const TeacherView: React.FC<TeacherViewProps> = ({ currentUser, refreshUser }) => {
  const [activeTab, setActiveTab] = useState<'STUDENTS' | 'APPROVALS' | 'REPORTS' | 'SECURITY' | 'PRESENTATION' | 'HOW_TO' | 'ARCADE'>('STUDENTS');
  const [students, setStudents] = useState<User[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [pendingQuizApprovals, setPendingQuizApprovals] = useState<any[]>([]); 
  const [reports, setReports] = useState<StudentReport[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  // Student Detail View State
  const [availableWeeks, setAvailableWeeks] = useState<{weekId: string, completion: number}[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>(getCurrentWeekId());
  const [studentExpenses, setStudentExpenses] = useState<ExpenseRequest[]>([]); // GASTOS ALUMNO

  // Reports View State
  const [classExpenses, setClassExpenses] = useState<ExpenseRequest[]>([]); // GASTOS CLASE

  // Arcade Management State
  const [teacherQuizzes, setTeacherQuizzes] = useState<Quiz[]>([]);
  const [allQuizResults, setAllQuizResults] = useState<QuizResult[]>([]); // NEW: Store who did what
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(false);
  const [isCreatingQuiz, setIsCreatingQuiz] = useState(false); // Estado para evitar doble submit
  const [quizToDelete, setQuizToDelete] = useState<string | null>(null); // State for custom delete quiz modal
  const [quizCompletionsView, setQuizCompletionsView] = useState<string | null>(null); // State to view completion list

  // Management Modal State
  const [showManageModal, setShowManageModal] = useState(false);
  const [studentToManage, setStudentToManage] = useState<User | null>(null);
  const [newStudentPass, setNewStudentPass] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [showDeleteStudentModal, setShowDeleteStudentModal] = useState(false); // State for custom delete student modal

  // Security / Access Code State
  const [currentAccessCode, setCurrentAccessCode] = useState('');
  const [newAccessCode, setNewAccessCode] = useState('');
  const [updatingCode, setUpdatingCode] = useState(false);
  
  // Teacher Password Change State
  const [newTeacherPass, setNewTeacherPass] = useState('');
  const [confirmTeacherPass, setConfirmTeacherPass] = useState('');
  const [passSuccess, setPassSuccess] = useState(false); // Feedback visual
  
  // Factory Reset State
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmString, setResetConfirmString] = useState('');

  // Quiz Modal State
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizType, setQuizType] = useState<QuizType>('TEXT');
  const [question, setQuestion] = useState('');
  const [reward, setReward] = useState(50);
  const [assignedTo, setAssignedTo] = useState('ALL');
  
  // Dynamic Game State
  const [textOptions, setTextOptions] = useState(['', '', '', '']); // Used for TEXT and INTRUDER and SEQUENCE
  const [correctIndex, setCorrectIndex] = useState(0); // Used for TEXT and INTRUDER
  const [gameItems, setGameItems] = useState<string[]>(['', '', '']); // Used for SENTENCE
  const [sortItems, setSortItems] = useState<{text: string, cat: 'NEED'|'WANT'}[]>([{text: '', cat: 'NEED'}, {text: '', cat: 'WANT'}]);

  useEffect(() => {
    loadData();
    if (activeTab === 'SECURITY' || activeTab === 'PRESENTATION') {
        loadSecuritySettings();
    }
    if (activeTab === 'ARCADE') {
        loadArcadeData();
    }
    if (activeTab === 'REPORTS') {
        loadClassExpenses();
    }
    
    // Suscripciones en tiempo real
    const subscription = supabaseService.subscribeToChanges('profiles', undefined, () => {
        loadData();
    });
    
    const quizResultSub = supabaseService.subscribeToChanges('quiz_results', undefined, () => {
        loadData(); 
        if (activeTab === 'ARCADE') loadArcadeData(); // Reload stats if someone plays
    });

    const quizzesSub = supabaseService.subscribeToChanges('quizzes', undefined, () => {
        // Recarga automática al detectar cambios en quizzes (creación o borrado por otro usuario)
        if (activeTab === 'ARCADE') loadArcadeData();
    });
    
    const expensesSub = supabaseService.subscribeToChanges('expense_requests', undefined, () => {
        if (activeTab === 'REPORTS') loadClassExpenses();
        if (selectedStudent) loadStudentDetails(selectedStudent);
    });

    return () => {
        subscription.unsubscribe();
        quizResultSub.unsubscribe();
        quizzesSub.unsubscribe();
        expensesSub.unsubscribe();
    };
  }, [activeTab]);

  const loadData = async () => {
    const s = await supabaseService.getStudents();
    setStudents(s);
    const p = await supabaseService.getPendingUsers();
    setPendingUsers(p);
    const q = await supabaseService.getPendingQuizApprovals();
    setPendingQuizApprovals(q);
    const r = await supabaseService.getClassReport();
    setReports(r);
  };

  const loadArcadeData = async () => {
      setIsLoadingQuizzes(true);
      try {
          const [q, r] = await Promise.all([
             supabaseService.getAllTeacherQuizzes(),
             supabaseService.getAllQuizResults()
          ]);
          setTeacherQuizzes(q);
          setAllQuizResults(r);
      } catch (e) {
          console.error("Error loading quizzes", e);
      } finally {
          setIsLoadingQuizzes(false);
      }
  };

  const loadClassExpenses = async () => {
      const ex = await supabaseService.getAllClassExpenses();
      setClassExpenses(ex);
  };

  const loadStudentDetails = async (uid: string) => {
      const weeks = await supabaseService.getStudentWeeks(uid);
      setAvailableWeeks(weeks);
      if (weeks.length > 0) {
         setSelectedWeek(weeks[0].weekId);
      } else {
         setSelectedWeek(getCurrentWeekId());
      }
      const exp = await supabaseService.getExpenseRequests(uid);
      setStudentExpenses(exp);
  };

  useEffect(() => {
    if (selectedStudent) {
       loadStudentDetails(selectedStudent);
    }
  }, [selectedStudent]);

  const loadSecuritySettings = async () => {
      const code = await supabaseService.getRegistrationCode();
      setCurrentAccessCode(code);
  };

  const handleUpdateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccessCode.trim()) return;
    setUpdatingCode(true);
    const success = await supabaseService.updateRegistrationCode(newAccessCode);
    setUpdatingCode(false);
    if (success) {
        setCurrentAccessCode(newAccessCode);
        setNewAccessCode('');
        alert('¡Código de Registro actualizado!');
    }
  };

  const handleAdminResetPass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!studentToManage || !newStudentPass) return;
    setActionLoading(true);
    const result = await supabaseService.adminResetStudentPassword(studentToManage.uid, newStudentPass);
    setActionLoading(false);
    if (result.success) {
        alert(`Contraseña de ${studentToManage.displayName} actualizada.`);
        setNewStudentPass('');
        setShowManageModal(false);
    }
  };

  // --- TRIGGER DELETE CONFIRMATION ---
  const handleRequestDeleteStudent = () => {
    if (!studentToManage) return;
    
    if (deleteConfirm.toUpperCase() !== 'ELIMINAR') {
        alert(`Texto de seguridad incorrecto.\nEsperado: ELIMINAR\nEscrito: ${deleteConfirm}`);
        return;
    }
    // Instead of window.confirm, open custom modal
    setShowDeleteStudentModal(true);
  };

  // --- EXECUTE STUDENT DELETION ---
  const executeStudentDeletion = async () => {
    if (!studentToManage) return;

    setActionLoading(true);
    const result = await supabaseService.deleteStudent(studentToManage.uid);
    setActionLoading(false);
    
    if (result.success) {
        setShowDeleteStudentModal(false);
        setShowManageModal(false);
        setSelectedStudent(null);
        setDeleteConfirm('');
        setStudentToManage(null);
        soundService.playSuccess();
        loadData(); 
    } else {
        alert(`❌ ERROR DE SUPABASE:\n\n${result.error}`);
        setShowDeleteStudentModal(false);
    }
  };

  const handleTeacherPasswordChange = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newTeacherPass || newTeacherPass !== confirmTeacherPass) {
          alert("Las contraseñas no coinciden o están vacías.");
          return;
      }
      setUpdatingCode(true);
      const result = await supabaseService.updatePassword(newTeacherPass);
      setUpdatingCode(false);
      
      if (result.success) {
          // FEEDBACK VISUAL Y ALERTA
          setPassSuccess(true);
          setNewTeacherPass('');
          setConfirmTeacherPass('');
          setTimeout(() => setPassSuccess(false), 4000);
          soundService.playSuccess();
          alert('¡Contraseña actualizada con éxito!');
      } else {
          alert("Error: " + result.error);
      }
  };

  const handleMasterReset = async () => {
      if (resetConfirmString.toUpperCase() !== 'REINICIAR') {
          alert("Debes escribir REINICIAR para confirmar.");
          return;
      }
      
      setActionLoading(true);
      const result = await supabaseService.resetSystemData(currentUser.uid);
      setActionLoading(false);
      
      if (result.success) {
          setShowResetModal(false);
          setResetConfirmString('');
          alert("✅ El sistema se ha reiniciado. La base de datos está limpia.");
          // FIX: Force go to root to prevent 404 on reload
          window.location.href = '/';
      } else {
          alert("Error al reiniciar: " + result.error);
      }
  };

  const handleApprove = async (uid: string) => { await supabaseService.approveUser(uid); loadData(); };
  const handleReject = async (uid: string) => { await supabaseService.rejectUser(uid); loadData(); };
  const handleApproveQuiz = async (id: string) => { await supabaseService.approveQuizRedemption(id); loadData(); };
  const handleRejectQuiz = async (id: string) => { await supabaseService.rejectQuizRedemption(id); loadData(); };

  // --- FIXED: RESET FORM ---
  const resetForm = (targetType: QuizType = 'TEXT') => { 
      setQuestion(''); 
      setReward(50); 
      setQuizType(targetType); 
      setTextOptions(['', '', '', '']); 
      setCorrectIndex(0); 
      setGameItems(['', '', '']); 
      setSortItems([{text: '', cat: 'NEED'}, {text: '', cat: 'WANT'}]); 
      setAssignedTo('ALL'); 
  };

  // --- FIXED: CREATE QUIZ HANDLER ---
  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault(); // STOP PAGE RELOAD
    
    if (!question.trim()) {
        alert("¡Escribe una pregunta, pista o instrucción!");
        return;
    }

    if (isCreatingQuiz) return;
    setIsCreatingQuiz(true);

    const newQuiz: any = { 
        type: quizType, 
        question, 
        reward: Number(reward), 
        difficulty: 'MEDIUM', 
        assignedTo // Camel case here, service maps it
    };

    // Mapeo de datos específicos según el tipo
    if (quizType === 'TEXT') { 
        newQuiz.options = textOptions.slice(0, 3); // Solo 3 opciones para Trivia
        newQuiz.correctIndex = Number(correctIndex); 
    }
    else if (quizType === 'INTRUDER') {
        newQuiz.options = textOptions; // Las 4 opciones
        newQuiz.correctIndex = Number(correctIndex);
    }
    else if (quizType === 'SENTENCE') { 
        newQuiz.gameItems = gameItems.filter(t => t.trim()).map((t, i) => ({ id: `${i}`, text: t })); 
    }
    else if (quizType === 'SEQUENCE') {
        // Secuencia: Usamos textOptions como la lista de pasos en orden correcto
        const steps = textOptions.filter(t => t.trim() !== '');
        if (steps.length < 2) {
             alert("¡Escribe al menos 2 pasos para la secuencia!");
             setIsCreatingQuiz(false);
             return;
        }
        newQuiz.options = steps;
    }
    else if (quizType === 'SORTING') { 
        newQuiz.gameItems = sortItems.filter(i => i.text.trim()).map((item, i) => ({ id: `${i}`, text: item.text, category: item.cat })); 
    }
    
    try {
        const result = await supabaseService.createTeacherQuiz(newQuiz);
        
        if (result.success) {
            setShowQuizModal(false);
            loadArcadeData(); 
            resetForm(); // Defaults to TEXT, which is fine after closing
            soundService.playSuccess();
            alert("✅ Juego creado correctamente.");
        } else {
            alert(`Error al crear el juego:\n${result.error}`);
        }
    } catch (err: any) {
        alert(`Error inesperado: ${err.message}`);
    } finally {
        setIsCreatingQuiz(false);
    }
  };

  // --- CONFIRM DELETION LOGIC ---
  const confirmDeleteQuiz = async () => {
      if (!quizToDelete) return;
      
      setActionLoading(true);
      // Optimistic update
      setTeacherQuizzes(prev => prev.filter(q => q.id !== quizToDelete));
      
      const result = await supabaseService.deleteQuiz(quizToDelete);
      
      setActionLoading(false);
      setQuizToDelete(null); // Close modal

      if (!result.success) {
          alert(`❌ ERROR DE BASE DE DATOS:\n\n${result.error}\n\nIntenta recargar la página.`);
          loadArcadeData(); // Revert
      } else {
          soundService.playPop();
      }
  };
  
  const activeStudentData = useMemo(() => students.find(s => s.uid === selectedStudent), [students, selectedStudent]);

  // Derived metrics for Presentation Mode
  const classTotalBalance = useMemo(() => students.reduce((sum, s) => sum + s.balance, 0), [students]);
  const classCompletionStats = useMemo(() => {
    let sTotal = 0, sComp = 0, hTotal = 0, hComp = 0;
    reports.forEach(r => {
        sTotal += r.schoolTasksTotal;
        sComp += r.schoolTasksCompleted;
        hTotal += r.homeTasksTotal;
        hComp += r.homeTasksCompleted;
    });
    return {
        school: sTotal > 0 ? (sComp / sTotal) * 100 : 0,
        home: hTotal > 0 ? (hComp / hTotal) * 100 : 0
    };
  }, [reports]);

  // --- RENDER ---
  return (
    <div className="space-y-6">
      {/* NAVBAR DE MAESTRA */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-2 rounded-3xl border-b-4 border-slate-200 shadow-sm overflow-x-auto">
        <div className="flex p-1 bg-slate-100 rounded-2xl w-full md:w-auto">
           {[
             { id: 'STUDENTS', label: 'Alumnos', icon: <School size={18}/> },
             { id: 'ARCADE', label: 'Juegos', icon: <LayoutGrid size={18}/> },
             { id: 'REPORTS', label: 'Informe', icon: <BarChart3 size={18}/> },
             { id: 'APPROVALS', label: 'Solicitudes', icon: <Clock size={18}/> },
             { id: 'SECURITY', label: 'Seguridad', icon: <Lock size={18}/> }
           ].map(tab => (
             <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all whitespace-nowrap ${activeTab === tab.id ? 'bg-white text-violet-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
             >
                {tab.icon}
                <span className="hidden sm:inline">{tab.label}</span>
                {tab.id === 'APPROVALS' && (pendingUsers.length + pendingQuizApprovals.length) > 0 && (
                   <span className="bg-red-500 text-white text-[10px] px-1.5 py-0.5 rounded-full ml-1">
                      {pendingUsers.length + pendingQuizApprovals.length}
                   </span>
                )}
             </button>
           ))}
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
           <button onClick={() => setActiveTab('HOW_TO')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all ${activeTab === 'HOW_TO' ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
              <Lightbulb size={18}/> <span className="hidden lg:inline">CÓMO</span>
           </button>
           <button onClick={() => setActiveTab('PRESENTATION')} className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-black text-xs transition-all ${activeTab === 'PRESENTATION' ? 'bg-slate-800 text-yellow-400' : 'bg-slate-100 text-slate-500'}`}>
              <Projector size={18}/> <span className="hidden lg:inline">PROYECTAR</span>
           </button>
        </div>
      </div>

      {/* PESTAÑA ALUMNOS (DETALLES Y TAREAS) */}
      {activeTab === 'STUDENTS' && (
        <div className="grid md:grid-cols-4 gap-6 animate-fade-in">
          <div className="md:col-span-1 space-y-3">
            <h3 className="font-bold text-slate-400 text-[10px] uppercase tracking-widest mb-2 pl-2">Lista de Clase</h3>
            {students.length === 0 && <p className="text-slate-400 text-sm text-center py-10">Esperando alumnos...</p>}
            {students.map(s => (
              <button 
                key={s.uid} 
                onClick={() => setSelectedStudent(s.uid)} 
                className={`w-full text-left p-3 rounded-2xl flex items-center justify-between border-2 transition-all ${selectedStudent === s.uid ? 'border-violet-500 bg-violet-50 shadow-md scale-105 z-10' : 'border-white bg-white hover:border-slate-200'}`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full border-2 border-white shadow-sm overflow-hidden bg-slate-100">
                    <img src={s.avatar} alt="Avatar" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <div className="font-black text-slate-700 leading-tight text-xs">{s.displayName.split(' ')[0]}</div>
                    {/* DISPLAY BALANCE AS GB AND MB */}
                    <div className="text-[9px] text-slate-500 font-bold mt-0.5 flex items-center gap-1">
                      <img src="https://i.ibb.co/kVhqQ0K9/gemabit.png" className="w-2.5 h-2.5" /> 
                      {Math.floor(s.balance/100)} GB <span className="opacity-50">|</span> {s.balance % 100} MB
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="md:col-span-3">
            {activeStudentData ? (
              <div className="animate-fade-in space-y-6">
                <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border-2 border-slate-100">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4 w-full">
                      <div className="w-16 h-16 rounded-2xl bg-violet-50 p-1 shrink-0 border-2 border-violet-100 overflow-hidden">
                        <img src={activeStudentData.avatar} className="w-full h-full object-cover rounded-xl" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-xl text-slate-800">{activeStudentData.displayName}</h3>
                          <button onClick={() => { setStudentToManage(activeStudentData); setShowManageModal(true); }} className="p-1.5 text-slate-300 hover:text-slate-500"><Settings size={18}/></button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2">
                          <span className="text-[10px] font-black bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg flex items-center gap-1 border border-emerald-200 shadow-sm">
                            <img src="https://i.ibb.co/kVhqQ0K9/gemabit.png" className="w-3 h-3"/>
                            {Math.floor(activeStudentData.balance / 100)} GemaBits
                          </span>
                          <span className="text-[10px] font-black bg-amber-100 text-amber-700 px-3 py-1 rounded-lg flex items-center gap-1 border border-amber-200 shadow-sm">
                            <img src="https://i.ibb.co/JWvYtPhJ/minibit-1.png" className="w-3 h-3"/>
                            {activeStudentData.balance % 100} MiniBits
                          </span>
                        </div>
                      </div>
                    </div>
                    <button 
                      onClick={() => { setAssignedTo(activeStudentData.uid); setShowQuizModal(true); }} 
                      className="w-full sm:w-auto bg-sky-500 text-white px-5 py-3 rounded-xl font-bold text-xs shadow-lg shadow-sky-100 hover:bg-sky-400 active:translate-y-1 transition-all flex items-center justify-center gap-2 border-b-4 border-sky-700"
                    >
                      <Plus size={16} strokeWidth={3} /> Asignar Juego
                    </button>
                  </div>

                  <div className="border-t border-slate-50 mt-6 pt-4">
                     <div className="flex items-center gap-3">
                         <div className="p-2 bg-slate-100 text-slate-500 rounded-lg"><Calendar size={20}/></div>
                         <div className="relative flex-1">
                             <select value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)} className="w-full appearance-none bg-slate-50 border-2 border-slate-100 rounded-xl p-3 pr-10 font-black text-slate-600 focus:outline-none focus:border-violet-500 transition-colors text-sm">
                                 {availableWeeks.map(week => (<option key={week.weekId} value={week.weekId}>Semana {week.weekId.split('-W')[1]} ({week.weekId === getCurrentWeekId() ? 'Actual' : week.weekId.split('-W')[0]})</option>))}
                             </select>
                             <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                         </div>
                     </div>
                  </div>
                </div>

                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-[2rem] p-6 border-2 border-slate-100 shadow-sm">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-violet-100 text-violet-600 rounded-xl"><School size={24} /></div>
                        <h3 className="font-black text-slate-700 text-lg">Escuela</h3>
                      </div>
                      <TaskController studentId={activeStudentData.uid} allowedType="SCHOOL" weekId={selectedWeek} onUpdate={loadData} />
                  </div>
                  <div className="bg-slate-50 rounded-[2rem] p-6 border-2 border-slate-100">
                      <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><Home size={24} /></div>
                        <h3 className="font-black text-slate-700 text-lg">Casa</h3>
                      </div>
                      <TaskController studentId={activeStudentData.uid} allowedType="HOME" readOnly={true} weekId={selectedWeek} />
                  </div>
                </div>
                
                {/* HISTORIAL DE GASTOS DEL ALUMNO */}
                <div className="bg-white rounded-[2rem] p-6 border-2 border-slate-100 shadow-sm">
                   <div className="flex items-center gap-3 mb-6">
                       <div className="p-3 bg-rose-100 text-rose-600 rounded-xl"><ShoppingBag size={24} /></div>
                       <h3 className="font-black text-slate-700 text-lg">Historial de Gastos</h3>
                   </div>
                   {studentExpenses.length === 0 ? (
                       <p className="text-center text-slate-400 text-sm font-bold py-6 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                           Sin gastos registrados.
                       </p>
                   ) : (
                       <div className="space-y-3 max-h-60 overflow-y-auto pr-2">
                           {studentExpenses.map(exp => (
                               <div key={exp.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                   <div>
                                       <p className="font-black text-slate-700 text-sm">{exp.description}</p>
                                       <div className="flex items-center gap-2 mt-1">
                                           <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase
                                               ${exp.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-600' : ''}
                                               ${exp.status === 'REJECTED' ? 'bg-rose-100 text-rose-600' : ''}
                                               ${exp.status === 'PENDING' ? 'bg-amber-100 text-amber-600' : ''}
                                           `}>
                                               {exp.status === 'APPROVED' ? 'Aprobado' : exp.status === 'REJECTED' ? 'Rechazado' : 'Pendiente'}
                                           </span>
                                           {exp.category === 'NEED' && <span className="text-[10px] font-bold text-emerald-500 bg-white px-1.5 py-0.5 rounded border border-emerald-100 flex items-center gap-1"><Heart size={10}/> Necesidad</span>}
                                           {exp.category === 'WANT' && <span className="text-[10px] font-bold text-pink-500 bg-white px-1.5 py-0.5 rounded border border-pink-100 flex items-center gap-1"><Star size={10}/> Capricho</span>}
                                       </div>
                                   </div>
                                   <div className="text-right">
                                       <div className="font-black text-rose-500 text-sm flex items-center justify-end gap-1">
                                           <TrendingDown size={14}/> -{exp.amount}
                                       </div>
                                       {exp.sentiment && (
                                            <div className="mt-1 flex justify-end">
                                                {exp.sentiment === 'HAPPY' && <SmilePlus size={16} className="text-emerald-500"/>}
                                                {exp.sentiment === 'NEUTRAL' && <Meh size={16} className="text-amber-500"/>}
                                                {exp.sentiment === 'SAD' && <Frown size={16} className="text-rose-500"/>}
                                            </div>
                                       )}
                                   </div>
                               </div>
                           ))}
                       </div>
                   )}
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-300 border-4 border-dashed border-slate-100 rounded-[3rem] bg-slate-50/50">
                <School size={60} className="mb-4 text-slate-200" />
                <p className="font-black text-lg">Selecciona un alumno para evaluar</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PESTAÑA ARCADE (GESTIÓN DE JUEGOS) */}
      {activeTab === 'ARCADE' && (
          <div className="space-y-6 animate-fade-in">
              <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl border-b-[8px] border-violet-900/50 flex flex-col md:flex-row justify-between items-center gap-6">
                  <div className="relative z-10 text-center md:text-left">
                      <h2 className="text-3xl font-black mb-2 flex items-center justify-center md:justify-start gap-3">
                          <Gamepad2 size={40} className="text-yellow-400" />
                          Gestión de Juegos
                      </h2>
                      <p className="text-violet-100 font-bold opacity-80 max-w-md">
                          Crea y administra los desafíos educativos del Arcade. Los alumnos ganan MiniBits resolviéndolos.
                      </p>
                  </div>
                  <button 
                    onClick={() => { setAssignedTo('ALL'); setShowQuizModal(true); }}
                    className="relative z-10 w-full md:w-auto bg-white text-violet-600 hover:bg-violet-50 px-8 py-4 rounded-2xl font-black text-lg shadow-xl border-b-[6px] border-slate-200 active:border-b-0 active:translate-y-1.5 transition-all flex items-center justify-center gap-3"
                  >
                      <Plus size={24} strokeWidth={4} /> Nuevo Juego
                  </button>
                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              </div>

              <div className="flex justify-between items-center px-2">
                  <h3 className="font-black text-slate-400 text-xs uppercase tracking-widest flex items-center gap-2">
                      Juegos en la Clase <span className="bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full text-[10px]">{teacherQuizzes.length}</span>
                  </h3>
                  <button onClick={loadArcadeData} disabled={isLoadingQuizzes} className="p-2 text-slate-400 hover:text-violet-600 bg-white border-2 border-slate-100 rounded-xl transition-all">
                      <RefreshCw size={18} className={isLoadingQuizzes ? 'animate-spin' : ''} />
                  </button>
              </div>

              {isLoadingQuizzes ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {[1,2,3].map(i => <div key={i} className="bg-slate-100 h-40 rounded-[2rem] animate-pulse"></div>)}
                  </div>
              ) : teacherQuizzes.length === 0 ? (
                  <div className="text-center py-20 bg-white rounded-[3rem] border-4 border-dashed border-slate-100 shadow-inner">
                      <div className="p-6 bg-slate-50 rounded-full inline-block mb-4 text-slate-200"><BrainCircuit size={60} /></div>
                      <p className="text-slate-400 font-black">No has creado ningún juego todavía.</p>
                      <p className="text-slate-300 text-sm font-bold mt-1">¡Pulsa "Nuevo Juego" para empezar!</p>
                  </div>
              ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                      {teacherQuizzes.map(quiz => {
                          const visuals = getGameVisual(quiz.type);
                          const isGlobal = quiz.assignedTo === 'ALL';
                          const targetStudent = !isGlobal ? students.find(s => s.uid === quiz.assignedTo) : null;
                          
                          // Calculate who completed this game
                          const completions = allQuizResults.filter(r => r.quizId === quiz.id);
                          const uniqueStudentIds = Array.from(new Set(completions.map(c => c.studentId)));
                          const completedStudents = uniqueStudentIds.map(id => students.find(s => s.uid === id)).filter(Boolean) as User[];

                          return (
                              <div key={quiz.id} className="bg-white p-5 rounded-[2.5rem] shadow-sm border-2 border-slate-100 hover:border-violet-300 hover:shadow-xl transition-all flex flex-col group relative h-full">
                                  
                                  <div className="flex justify-between items-start mb-4">
                                      {/* ICONO DEL JUEGO */}
                                      <div className={`p-2.5 rounded-xl ${visuals.bg} ${visuals.color} border ${visuals.border}`}>
                                          {visuals.icon}
                                      </div>
                                      
                                      <div className="flex items-center gap-2">
                                          {/* RECOMPENSA */}
                                          <div className="bg-yellow-400 text-yellow-900 px-3 py-1 rounded-xl text-xs font-black shadow-sm flex items-center gap-1 border-b-2 border-yellow-600">
                                              <img src="https://i.ibb.co/JWvYtPhJ/minibit-1.png" className="w-3.5 h-3.5" /> +{quiz.reward}
                                          </div>
                                          
                                          {/* BOTÓN BORRAR - TRIGGER CUSTOM MODAL */}
                                          <button 
                                              onClick={(e) => { 
                                                  e.stopPropagation(); 
                                                  setQuizToDelete(quiz.id);
                                              }}
                                              className="px-3 py-1.5 bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-500 rounded-xl transition-colors border border-slate-200 text-[10px] font-black uppercase flex items-center gap-1.5 z-20 relative cursor-pointer active:scale-95"
                                              title="Eliminar Juego"
                                          >
                                              <Trash2 size={14} strokeWidth={2.5} /> Borrar
                                          </button>
                                      </div>
                                  </div>

                                  <div className="mb-2">
                                      <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${visuals.bg} ${visuals.color}`}>
                                          {visuals.label}
                                      </span>
                                  </div>

                                  <h4 className="font-black text-slate-800 text-sm leading-tight mb-6 line-clamp-3">
                                      {quiz.question}
                                  </h4>

                                  <div className="mt-auto pt-4 border-t border-slate-50 flex flex-col gap-3">
                                      {/* ASIGNADO A... */}
                                      {isGlobal ? (
                                          <div className="flex items-center gap-2 text-[10px] font-black text-sky-600 bg-sky-50 px-3 py-1.5 rounded-lg w-full">
                                              <Star size={14} className="fill-sky-500" /> TODA LA CLASE
                                          </div>
                                      ) : (
                                          <div className="flex items-center gap-2 text-[10px] font-black text-violet-600 bg-violet-50 px-3 py-1.5 rounded-lg w-full">
                                              <div className="w-5 h-5 rounded-full overflow-hidden bg-white border border-violet-200">
                                                  <img src={targetStudent?.avatar || ''} className="w-full h-full object-cover" />
                                              </div>
                                              <span className="truncate">PARA: {targetStudent?.displayName.toUpperCase() || 'ALUMNO'}</span>
                                          </div>
                                      )}

                                      {/* QUIÉN LO HIZO (Facepile - Clickable) */}
                                      {completedStudents.length > 0 ? (
                                          <button 
                                            onClick={(e) => { 
                                                e.stopPropagation(); 
                                                setQuizCompletionsView(quiz.id);
                                            }}
                                            className="flex items-center gap-2 group/pile hover:bg-slate-50 p-1.5 -ml-1.5 rounded-xl transition-all cursor-pointer"
                                          >
                                              <div className="flex -space-x-2 overflow-hidden pl-1">
                                                  {completedStudents.slice(0, 5).map((s, idx) => (
                                                      <div key={idx} className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 overflow-hidden relative shadow-sm" title={s.displayName}>
                                                          <img src={s.avatar} className="w-full h-full object-cover" />
                                                      </div>
                                                  ))}
                                                  {completedStudents.length > 5 && (
                                                      <div className="w-6 h-6 rounded-full border-2 border-white bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-500">
                                                          +{completedStudents.length - 5}
                                                      </div>
                                                  )}
                                              </div>
                                              <span className="text-[9px] font-bold text-slate-400 group-hover/pile:text-violet-500 transition-colors">Ver lista</span>
                                          </button>
                                      ) : (
                                          <div className="text-[9px] font-bold text-slate-300 italic px-1">
                                              Nadie lo ha completado aún
                                          </div>
                                      )}
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              )}
          </div>
      )}

      {/* PESTAÑA SEGURIDAD */}
      {activeTab === 'SECURITY' && (
          <div className="animate-fade-in grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              
              {/* CÓDIGO DE REGISTRO */}
              <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border-2 border-slate-100">
                  <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-sky-100 text-sky-600 rounded-2xl">
                          <KeyRound size={24} />
                      </div>
                      <h3 className="font-black text-slate-700 text-lg">Código de Acceso</h3>
                  </div>
                  
                  <div className="text-center mb-6 p-4 bg-slate-50 rounded-2xl border-2 border-slate-100">
                      <p className="text-slate-400 text-xs font-bold uppercase mb-1 tracking-widest">Código Actual</p>
                      <p className="text-3xl font-black text-slate-800 tracking-[0.2em] font-mono">{currentAccessCode}</p>
                  </div>

                  <form onSubmit={handleUpdateCode} className="space-y-3">
                      <input 
                        type="text" 
                        value={newAccessCode} 
                        onChange={e => setNewAccessCode(e.target.value)} 
                        placeholder="Nuevo código" 
                        className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-3 font-bold text-slate-700 focus:border-sky-500 outline-none transition-colors text-sm"
                      />
                      <button disabled={updatingCode} className="w-full bg-sky-500 text-white font-black py-3 rounded-xl border-b-4 border-sky-700 active:border-b-0 active:translate-y-1 transition-all">
                          {updatingCode ? 'Guardando...' : 'Cambiar Código'}
                      </button>
                  </form>
              </div>

              {/* CAMBIAR CONTRASEÑA */}
              <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border-2 border-slate-100 relative overflow-hidden">
                  <div className="flex items-center gap-3 mb-6">
                      <div className="p-3 bg-violet-100 text-violet-600 rounded-2xl">
                          <Lock size={24} />
                      </div>
                      <h3 className="font-black text-slate-700 text-lg">Mi Contraseña</h3>
                  </div>
                  
                  {passSuccess && (
                     <div className="absolute top-0 left-0 w-full bg-emerald-500 text-white p-2 text-center text-xs font-black animate-slide-up flex items-center justify-center gap-2">
                        <Check size={16}/> ¡Contraseña actualizada!
                     </div>
                  )}

                  <form onSubmit={handleTeacherPasswordChange} className="space-y-4">
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 pl-2">Nueva Contraseña</label>
                          <input 
                            type="password" 
                            value={newTeacherPass} 
                            onChange={e => setNewTeacherPass(e.target.value)} 
                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-3 font-bold text-slate-700 focus:border-violet-500 outline-none transition-colors text-sm"
                          />
                      </div>
                      <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 pl-2">Confirmar</label>
                          <input 
                            type="password" 
                            value={confirmTeacherPass} 
                            onChange={e => setConfirmTeacherPass(e.target.value)} 
                            className="w-full bg-slate-50 border-2 border-slate-200 rounded-xl p-3 font-bold text-slate-700 focus:border-violet-500 outline-none transition-colors text-sm"
                          />
                      </div>
                      <button disabled={updatingCode || !newTeacherPass} className="w-full bg-violet-500 text-white font-black py-3 rounded-xl border-b-4 border-violet-700 active:border-b-0 active:translate-y-1 transition-all mt-2 disabled:opacity-50">
                          {updatingCode ? 'Actualizando...' : 'Actualizar Clave'}
                      </button>
                  </form>
              </div>

              {/* ZONA DE PELIGRO (RESET) */}
              <div className="bg-red-50 rounded-[2.5rem] p-6 border-2 border-red-100 flex flex-col justify-between">
                  <div>
                      <div className="flex items-center gap-3 mb-4">
                          <div className="p-3 bg-red-100 text-red-600 rounded-2xl">
                              <TriangleAlert size={24} />
                          </div>
                          <h3 className="font-black text-red-700 text-lg">Zona de Peligro</h3>
                      </div>
                      <p className="text-red-500 text-xs font-bold leading-relaxed mb-6">
                          Aquí puedes reiniciar toda la aplicación para empezar un nuevo curso escolar. Esta acción es irreversible.
                      </p>
                  </div>
                  
                  <button 
                    onClick={() => setShowResetModal(true)}
                    className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-4 rounded-2xl border-b-[6px] border-red-800 active:border-b-0 active:translate-y-1 transition-all uppercase tracking-widest shadow-lg shadow-red-100 flex items-center justify-center gap-2"
                  >
                      <Trash2 size={20} /> Reinicio de Fábrica
                  </button>
              </div>
          </div>
      )}

      {/* MODAL CREAR JUEGO (UPDATED for Sequence) */}
      {showQuizModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[100] backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2.5rem] max-w-lg w-full p-8 border-b-[10px] border-slate-200 shadow-2xl max-h-[90vh] overflow-y-auto relative">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-black text-2xl text-slate-800 flex items-center gap-3">
                <div className="p-2.5 bg-violet-100 text-violet-600 rounded-xl"><BrainCircuit size={28} /></div> 
                Nuevo Arcade
              </h3>
              <button onClick={() => setShowQuizModal(false)} className="p-2.5 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-500 transition-colors">
                <X size={24} strokeWidth={3} />
              </button>
            </div>

            <form onSubmit={handleCreateQuiz} className="space-y-6">
              <div className="grid grid-cols-5 gap-2">
                {[
                  { id: 'TEXT', icon: <MessageCircleQuestion size={20}/>, label: 'Trivia', color: 'bg-sky-500' },
                  { id: 'SENTENCE', icon: <Puzzle size={20}/>, label: 'Frase', color: 'bg-orange-500' },
                  { id: 'SORTING', icon: <Layers size={20}/>, label: 'Categoría', color: 'bg-violet-500' },
                  { id: 'SEQUENCE', icon: <ListOrdered size={20}/>, label: 'Secuencia', color: 'bg-cyan-500' },
                  { id: 'INTRUDER', icon: <Ghost size={20}/>, label: 'Intruso', color: 'bg-indigo-500' },
                ].map(t => (
                  <button 
                    key={t.id} 
                    type="button" 
                    onClick={() => resetForm(t.id as QuizType)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-2xl border-2 text-[8px] font-black uppercase tracking-widest transition-all ${quizType === t.id ? `bg-white border-violet-500 text-violet-600 shadow-md scale-105 z-10` : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                  >
                    <div className={`p-2 rounded-xl mb-1.5 ${quizType === t.id ? 'text-white ' + t.color : 'text-slate-300 bg-white border border-slate-100'}`}>
                      {t.icon}
                    </div>
                    {t.label}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest pl-2">
                    {quizType === 'SEQUENCE' ? 'Instrucción (Ej: Ordena los pasos)' : quizType === 'INTRUDER' ? 'Categoría / Contexto' : 'Instrucción / Pregunta'}
                </label>
                <textarea required rows={2} value={question} onChange={e => setQuestion(e.target.value)} className="w-full bg-slate-100 border-2 border-slate-200 rounded-2xl p-4 font-bold text-slate-700 focus:border-violet-500 focus:bg-white focus:outline-none transition-all resize-none" placeholder={quizType === 'SEQUENCE' ? "Ordena de menor a mayor..." : "Escribe aquí la consigna..."} />
              </div>

              {/* OPCIONES DINÁMICAS SEGÚN TIPO */}
              <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100 space-y-4">
                {quizType === 'TEXT' && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Opciones de respuesta</p>
                    {textOptions.slice(0,3).map((opt, i) => (
                      <div key={i} className="relative">
                        <input placeholder={`Opción ${i+1}`} value={opt} onChange={e => { const newOpts = [...textOptions]; newOpts[i] = e.target.value; setTextOptions(newOpts); }} className={`w-full bg-white border-2 rounded-xl p-3 pr-10 text-sm font-bold transition-all ${correctIndex === i ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 focus:border-violet-300'}`} />
                        <button type="button" onClick={() => setCorrectIndex(i)} className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${correctIndex === i ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-300'}`}><Check size={14} strokeWidth={4}/></button>
                      </div>
                    ))}
                  </div>
                )}

                {quizType === 'INTRUDER' && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Lista de Elementos (Marca el Intruso)</p>
                    {textOptions.map((opt, i) => (
                      <div key={i} className="relative">
                        <input placeholder={`Elemento ${i+1}`} value={opt} onChange={e => { const newOpts = [...textOptions]; newOpts[i] = e.target.value; setTextOptions(newOpts); }} className={`w-full bg-white border-2 rounded-xl p-3 pr-10 text-sm font-bold transition-all ${correctIndex === i ? 'border-indigo-500 bg-indigo-50' : 'border-slate-200 focus:border-indigo-300'}`} />
                        <button type="button" onClick={() => setCorrectIndex(i)} className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${correctIndex === i ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-300'}`}><Ghost size={14} strokeWidth={4}/></button>
                      </div>
                    ))}
                  </div>
                )}

                {quizType === 'SENTENCE' && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Palabras de la frase (En orden correcto)</p>
                    <div className="space-y-2">
                      {gameItems.map((item, i) => (
                        <div key={i} className="flex gap-2">
                          <input value={item} onChange={e => { const newItems = [...gameItems]; newItems[i] = e.target.value; setGameItems(newItems); }} className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 text-sm font-bold focus:border-violet-300 transition-all" placeholder="Palabra" />
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={() => setGameItems([...gameItems, ''])} className="text-[10px] font-black text-violet-500 hover:text-violet-700 flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 rounded-lg w-fit mt-2 border border-violet-100 shadow-sm"><Plus size={14} strokeWidth={4}/> AGREGAR</button>
                  </div>
                )}
                
                {quizType === 'SEQUENCE' && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pasos en Orden Correcto (1 a 4)</p>
                    {textOptions.map((opt, i) => (
                      <div key={i} className="relative">
                         <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xs">#{i+1}</div>
                         <input placeholder={`Paso ${i+1}`} value={opt} onChange={e => { const newOpts = [...textOptions]; newOpts[i] = e.target.value; setTextOptions(newOpts); }} className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 pl-10 text-sm font-bold transition-all focus:border-cyan-300" />
                      </div>
                    ))}
                  </div>
                )}

                {quizType === 'SORTING' && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Items para clasificar</p>
                    <div className="space-y-2">
                      {sortItems.map((item, i) => (
                        <div key={i} className="flex gap-2">
                          <input value={item.text} placeholder="Ej. Chocolate" onChange={e => { const newItems = [...sortItems]; newItems[i].text = e.target.value; setSortItems(newItems); }} className="flex-1 bg-white border-2 border-slate-200 rounded-xl p-3 text-sm font-bold focus:border-violet-300 transition-all" />
                          <select value={item.cat} onChange={e => { const newItems = [...sortItems]; newItems[i].cat = e.target.value as 'NEED' | 'WANT'; setSortItems(newItems); }} className={`rounded-xl border-2 text-[9px] font-black p-2 outline-none uppercase tracking-widest ${item.cat === 'NEED' ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-rose-100 border-rose-300 text-rose-700'}`}>
                            <option value="NEED">Vital</option>
                            <option value="WANT">Deseo</option>
                          </select>
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={() => setSortItems([...sortItems, {text: '', cat: 'NEED'}])} className="text-[10px] font-black text-violet-500 hover:text-violet-700 flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 rounded-lg w-fit mt-2 border border-violet-100 shadow-sm"><Plus size={14} strokeWidth={4}/> AGREGAR</button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase pl-2 tracking-widest">Premio (MB)</label>
                  <div className="relative">
                    <input type="number" min="1" max="500" value={reward} onChange={e => setReward(Number(e.target.value))} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black text-slate-700 focus:border-violet-500 focus:bg-white focus:outline-none transition-all" />
                    <img src="https://i.ibb.co/JWvYtPhJ/minibit-1.png" className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase pl-2 tracking-widest">Asignar A</label>
                  <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-4 font-black text-slate-700 focus:border-violet-500 focus:bg-white focus:outline-none transition-all text-[11px]">
                    <option value="ALL">⭐️ TODA LA CLASE</option>
                    {students.map(s => (<option key={s.uid} value={s.uid}>{s.displayName.toUpperCase()}</option>))}
                  </select>
                </div>
              </div>

              <button type="submit" disabled={isCreatingQuiz} className="w-full bg-violet-600 text-white font-black py-5 rounded-2xl border-b-[8px] border-violet-800 active:translate-y-1.5 active:border-b-0 transition-all uppercase tracking-widest mt-6 shadow-xl shadow-violet-100 text-sm disabled:opacity-50">
                {isCreatingQuiz ? <RefreshCw className="animate-spin mx-auto"/> : 'CREAR DESAFÍO'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR BORRAR JUEGO (FIXED) */}
      {quizToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[120] backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2.5rem] max-w-sm w-full p-6 shadow-2xl border-4 border-red-100 relative text-center">
             <div className="bg-red-100 p-4 rounded-full inline-block mb-4 text-red-500 animate-bounce-slow">
               <Trash2 size={32} />
             </div>
             <h3 className="font-black text-xl text-slate-800 mb-2">¿Borrar este Juego?</h3>
             <p className="text-xs font-bold text-slate-400 mb-6 px-4">
               Esta acción es permanente. Los alumnos dejarán de verlo en su Arcade.
             </p>
             <div className="flex gap-3">
               <button 
                 onClick={() => setQuizToDelete(null)}
                 className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-500 font-black rounded-xl transition-colors border-2 border-transparent"
               >
                 Cancelar
               </button>
               <button 
                 onClick={confirmDeleteQuiz}
                 disabled={actionLoading}
                 className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl shadow-lg border-b-4 border-red-700 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2"
               >
                 {actionLoading ? <RefreshCw className="animate-spin" size={18}/> : 'Sí, Borrar'}
               </button>
             </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMAR BORRAR ALUMNO */}
      {showDeleteStudentModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[110] backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2.5rem] max-w-sm w-full p-6 shadow-2xl border-4 border-red-100 relative text-center">
             <div className="bg-red-100 p-4 rounded-full inline-block mb-4 text-red-500">
               <ShieldAlert size={32} />
             </div>
             <h3 className="font-black text-xl text-slate-800 mb-2">Expulsar Alumno</h3>
             <p className="text-xs font-bold text-slate-400 mb-6 px-4">
               ¿Seguro que quieres eliminar a <span className="text-slate-800">{studentToManage?.displayName}</span>? Se perderá todo su progreso.
             </p>
             <div className="flex gap-3">
               <button 
                 onClick={() => setShowDeleteStudentModal(false)}
                 className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-500 font-black rounded-xl transition-colors"
               >
                 Cancelar
               </button>
               <button 
                 onClick={executeStudentDeletion}
                 disabled={actionLoading}
                 className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl shadow-lg border-b-4 border-red-700 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center gap-2"
               >
                 {actionLoading ? <RefreshCw className="animate-spin" size={18}/> : 'EXPULSAR'}
               </button>
             </div>
          </div>
        </div>
      )}

      {/* MODAL ADMINISTRAR ALUMNO (Reset Password) */}
      {showManageModal && studentToManage && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[100] backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-[2.5rem] w-full max-w-sm p-6 shadow-2xl relative overflow-hidden">
              <button onClick={() => setShowManageModal(false)} className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600"><X size={20}/></button>
              
              <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 bg-slate-100 rounded-2xl overflow-hidden border-2 border-slate-200">
                      <img src={studentToManage.avatar} className="w-full h-full object-cover"/>
                  </div>
                  <div>
                      <h3 className="font-black text-lg text-slate-800 leading-tight">{studentToManage.displayName}</h3>
                      <p className="text-xs font-bold text-slate-400 uppercase">Gestión de Cuenta</p>
                  </div>
              </div>

              <div className="space-y-6">
                  <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-100">
                      <h4 className="font-black text-slate-600 text-xs uppercase mb-3 flex items-center gap-2"><KeyRound size={14}/> Nueva Contraseña</h4>
                      <form onSubmit={handleAdminResetPass} className="flex gap-2">
                          <input required type="text" value={newStudentPass} onChange={e => setNewStudentPass(e.target.value)} placeholder="Escribe aquí..." className="flex-1 bg-white border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold focus:border-violet-500 outline-none" />
                          <button disabled={actionLoading} className="bg-violet-500 text-white p-2 rounded-xl border-b-4 border-violet-700 active:border-b-0 active:translate-y-1 transition-all"><Check size={18} strokeWidth={3}/></button>
                      </form>
                  </div>

                  <div className="border-t-2 border-slate-100 pt-4">
                      <h4 className="font-black text-red-500 text-xs uppercase mb-3 flex items-center gap-2"><ShieldAlert size={14}/> Zona de Peligro</h4>
                      <div className="space-y-2">
                          <p className="text-[10px] font-bold text-slate-400 mb-2">Para eliminar este alumno, escribe "ELIMINAR" abajo:</p>
                          <input type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="ELIMINAR" className="w-full bg-red-50 border-2 border-red-100 rounded-xl px-3 py-2 text-sm font-black text-red-600 focus:border-red-400 outline-none placeholder-red-200" />
                          <button onClick={handleRequestDeleteStudent} disabled={deleteConfirm.toUpperCase() !== 'ELIMINAR'} className="w-full bg-white border-2 border-red-100 text-red-500 font-black py-3 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                              <Trash2 size={16}/> Eliminar Cuenta
                          </button>
                      </div>
                  </div>
              </div>
           </div>
        </div>
      )}

      {/* MODAL RESET DE FABRICA */}
      {showResetModal && (
        <div className="fixed inset-0 bg-red-900/90 flex items-center justify-center p-4 z-[120] backdrop-blur-md animate-fade-in text-center">
            <div className="bg-white rounded-[3rem] w-full max-w-md p-8 shadow-2xl border-8 border-red-500 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-4 bg-stripes-red opacity-20"></div>
                <div className="mb-6 inline-block p-6 bg-red-100 text-red-600 rounded-full animate-pulse">
                    <AlertTriangle size={48} strokeWidth={2.5}/>
                </div>
                <h2 className="text-3xl font-black text-slate-800 mb-2">¿Reiniciar Todo?</h2>
                <p className="text-slate-500 font-bold text-sm mb-8 leading-relaxed">
                    Esto borrará <b>todos</b> los alumnos, tareas, monedas y juegos. La App volverá a estar vacía como el primer día.<br/><br/>
                    <span className="text-red-500">Esta acción no se puede deshacer.</span>
                </p>

                <div className="bg-slate-50 p-4 rounded-2xl border-2 border-slate-200 mb-6 text-left">
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 pl-1">Confirmación de Seguridad</label>
                    <input 
                        type="text" 
                        placeholder='Escribe "REINICIAR"'
                        value={resetConfirmString}
                        onChange={e => setResetConfirmString(e.target.value)}
                        className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 font-black text-slate-700 outline-none focus:border-red-500 transition-colors"
                    />
                </div>

                <div className="flex gap-3">
                    <button onClick={() => setShowResetModal(false)} className="flex-1 py-4 bg-slate-100 text-slate-500 font-black rounded-2xl hover:bg-slate-200 transition-colors">Cancelar</button>
                    <button 
                        onClick={handleMasterReset} 
                        disabled={resetConfirmString.toUpperCase() !== 'REINICIAR' || actionLoading}
                        className="flex-1 py-4 bg-red-600 text-white font-black rounded-2xl shadow-lg border-b-4 border-red-800 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50 disabled:grayscale"
                    >
                        {actionLoading ? 'Borrando...' : 'REINICIAR'}
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};
