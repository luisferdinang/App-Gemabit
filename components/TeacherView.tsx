import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, StudentReport, QuizType, QuizResult, Quiz } from '../types';
import { supabaseService, getCurrentWeekId } from '../services/supabaseService';
import { TaskController } from './TaskController';
import { 
  User as UserIcon, Check, X, ShieldAlert, BarChart3, Plus, BrainCircuit, School, 
  Home, Trophy, Gamepad2, RefreshCw, Lock, ShieldCheck, KeyRound, UserPlus, 
  Settings, Trash2, Calendar, ChevronDown, CheckCircle2, Clock, 
  MessageCircleQuestion, Puzzle, Layers, Scale, ListOrdered, Projector, 
  PartyPopper, Lightbulb, ArrowRight, ArrowLeft, Star, ShoppingBag, 
  Smartphone, Repeat, PiggyBank, TrendingUp, Wallet, LayoutGrid, Timer, 
  Camera, Upload, Search, Download, AlertTriangle, Database, Terminal, Copy, ExternalLink,
  Crown
} from 'lucide-react';
import { soundService } from '../services/soundService';

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

  // Access Code State
  const [currentAccessCode, setCurrentAccessCode] = useState('');
  const [newAccessCode, setNewAccessCode] = useState('');
  const [updatingCode, setUpdatingCode] = useState(false);

  // Quiz Modal State
  const [showQuizModal, setShowQuizModal] = useState(false);
  const [quizType, setQuizType] = useState<QuizType>('TEXT');
  const [question, setQuestion] = useState('');
  const [reward, setReward] = useState(50);
  const [assignedTo, setAssignedTo] = useState('ALL');
  
  const [textOptions, setTextOptions] = useState(['', '', '']);
  const [correctIndex, setCorrectIndex] = useState(0);
  const [targetValue, setTargetValue] = useState(50); 
  const [gameItems, setGameItems] = useState<string[]>(['', '', '']); 
  const [sortItems, setSortItems] = useState<{text: string, cat: 'NEED'|'WANT'}[]>([{text: '', cat: 'NEED'}, {text: '', cat: 'WANT'}]);

  useEffect(() => {
    loadData();
    if (activeTab === 'SECURITY') {
        loadSecuritySettings();
    }
    if (activeTab === 'ARCADE') {
        loadArcadeData();
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

    return () => {
        subscription.unsubscribe();
        quizResultSub.unsubscribe();
        quizzesSub.unsubscribe();
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

  const loadStudentDetails = async (uid: string) => {
      const weeks = await supabaseService.getStudentWeeks(uid);
      setAvailableWeeks(weeks);
      if (weeks.length > 0) {
         setSelectedWeek(weeks[0].weekId);
      } else {
         setSelectedWeek(getCurrentWeekId());
      }
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

  const handleApprove = async (uid: string) => { await supabaseService.approveUser(uid); loadData(); };
  const handleReject = async (uid: string) => { await supabaseService.rejectUser(uid); loadData(); };
  const handleApproveQuiz = async (id: string) => { await supabaseService.approveQuizRedemption(id); loadData(); };
  const handleRejectQuiz = async (id: string) => { await supabaseService.rejectQuizRedemption(id); loadData(); };

  // --- FIXED: CREATE QUIZ HANDLER ---
  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault(); // STOP PAGE RELOAD
    
    if (!question.trim()) {
        alert("¡Escribe una pregunta o instrucción!");
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
        newQuiz.options = textOptions; 
        newQuiz.correctIndex = Number(correctIndex); 
    }
    else if (quizType === 'SENTENCE' || quizType === 'ORDERING') { 
        newQuiz.gameItems = gameItems.filter(t => t.trim()).map((t, i) => ({ id: `${i}`, text: t })); 
    }
    else if (quizType === 'BALANCE') { 
        newQuiz.targetValue = Number(targetValue); 
    }
    else if (quizType === 'SORTING') { 
        newQuiz.gameItems = sortItems.filter(i => i.text.trim()).map((item, i) => ({ id: `${i}`, text: item.text, category: item.cat })); 
    }
    
    try {
        const result = await supabaseService.createTeacherQuiz(newQuiz);
        
        if (result.success) {
            setShowQuizModal(false);
            loadArcadeData(); 
            resetForm();
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

  const resetForm = () => { setQuestion(''); setReward(50); setQuizType('TEXT'); setTextOptions(['', '', '']); setCorrectIndex(0); setGameItems(['', '', '']); setSortItems([{text: '', cat: 'NEED'}, {text: '', cat: 'WANT'}]); setAssignedTo('ALL'); };
  
  const getGameVisual = (type: QuizType) => {
      switch(type) {
          case 'TEXT': return { icon: <MessageCircleQuestion size={20}/>, color: 'text-sky-600', bg: 'bg-sky-50', border: 'border-sky-200', label: 'Pregunta' };
          case 'SENTENCE': return { icon: <Puzzle size={20}/>, color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', label: 'Frase' };
          case 'SORTING': return { icon: <Layers size={20}/>, color: 'text-violet-600', bg: 'bg-violet-50', border: 'border-violet-200', label: 'Categoría' };
          case 'BALANCE': return { icon: <Scale size={20}/>, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', label: 'Ahorro' };
          case 'ORDERING': return { icon: <ListOrdered size={20}/>, color: 'text-pink-600', bg: 'bg-pink-50', border: 'border-pink-200', label: 'Pasos' };
          default: return { icon: <Gamepad2 size={20}/>, color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200', label: 'Juego' };
      }
  };

  const activeStudentData = useMemo(() => students.find(s => s.uid === selectedStudent), [students, selectedStudent]);

  const SQL_FIX = `
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes DISABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;

ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_student_id_fkey;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_student_id_fkey;
ALTER TABLE quiz_results DROP CONSTRAINT IF EXISTS quiz_results_student_id_fkey;
ALTER TABLE quiz_results DROP CONSTRAINT IF EXISTS quiz_results_quiz_id_fkey;

ALTER TABLE tasks ADD CONSTRAINT tasks_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD CONSTRAINT transactions_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE quiz_results ADD CONSTRAINT quiz_results_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE quiz_results ADD CONSTRAINT quiz_results_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE;

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
  `;

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

      {/* MODAL LISTA COMPLETADOS */}
      {quizCompletionsView && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[130] backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-[2rem] max-w-sm w-full p-6 shadow-2xl border-4 border-white relative max-h-[80vh] flex flex-col">
              <button 
                onClick={() => setQuizCompletionsView(null)} 
                className="absolute top-4 right-4 p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
              
              <div className="mb-4">
                  <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                      <Trophy size={24} className="text-yellow-400" />
                      Completado por
                  </h3>
                  <p className="text-xs font-bold text-slate-400">
                      Lista de alumnos que terminaron el juego
                  </p>
              </div>

              <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                  {(() => {
                      const completions = allQuizResults.filter(r => r.quizId === quizCompletionsView);
                      const uniqueStudentIds = Array.from(new Set(completions.map(c => c.studentId)));
                      const studentsInList = uniqueStudentIds.map(id => students.find(s => s.uid === id)).filter(Boolean) as User[];
                      
                      if (studentsInList.length === 0) return <p className="text-slate-400 font-bold text-center py-4">Nadie aún.</p>;

                      return studentsInList.map(s => (
                          <div key={s.uid} className="flex items-center gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                              <div className="w-10 h-10 rounded-full border-2 border-white shadow-sm overflow-hidden bg-white">
                                  <img src={s.avatar} className="w-full h-full object-cover"/>
                              </div>
                              <div>
                                  <p className="font-black text-slate-700 text-sm">{s.displayName}</p>
                                  <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-500">
                                      <CheckCircle2 size={12}/> Completado
                                  </div>
                              </div>
                          </div>
                      ));
                  })()}
              </div>
           </div>
        </div>
      )}

      {/* MODAL CONFIRMACION ELIMINAR JUEGO (CUSTOM UI) */}
      {quizToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[110] backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-[2rem] max-w-sm w-full p-6 shadow-2xl border-4 border-white text-center">
              <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce-slow">
                 <Trash2 size={32} />
              </div>
              <h3 className="text-xl font-black text-slate-800 mb-2">¿Eliminar Juego?</h3>
              <p className="text-sm font-bold text-slate-500 mb-6 leading-relaxed">
                 Esta acción eliminará el juego del Arcade para todos los alumnos.
              </p>
              
              <div className="flex gap-3">
                 <button 
                    onClick={() => setQuizToDelete(null)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-500 font-black rounded-xl transition-colors text-xs uppercase tracking-widest"
                 >
                    Cancelar
                 </button>
                 <button 
                    onClick={confirmDeleteQuiz}
                    disabled={actionLoading}
                    className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white font-black rounded-xl transition-colors shadow-lg shadow-red-200 text-xs uppercase tracking-widest flex items-center justify-center gap-2"
                 >
                    {actionLoading ? <RefreshCw className="animate-spin" size={16}/> : 'Sí, Eliminar'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL CONFIRMACION ELIMINAR ALUMNO (CUSTOM UI) */}
      {showDeleteStudentModal && studentToManage && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[120] backdrop-blur-sm animate-fade-in">
           <div className="bg-white rounded-[2rem] max-w-sm w-full p-6 shadow-2xl border-4 border-white text-center relative">
              <div className="w-20 h-20 rounded-full border-4 border-red-100 mx-auto mb-4 overflow-hidden shadow-sm bg-slate-100 relative">
                  <img src={studentToManage.avatar} className="w-full h-full object-cover grayscale opacity-80"/>
                  <div className="absolute inset-0 flex items-center justify-center bg-red-500/20">
                      <X size={40} className="text-red-600" strokeWidth={3}/>
                  </div>
              </div>
              <h3 className="text-xl font-black text-red-600 mb-2">¿Borrar Definitivamente?</h3>
              <p className="text-sm font-bold text-slate-500 mb-2 leading-tight">
                 Estás a punto de eliminar a <span className="text-slate-800">{studentToManage.displayName}</span>.
              </p>
              <p className="text-xs font-bold text-red-400 mb-6 uppercase tracking-wider bg-red-50 py-2 rounded-lg border border-red-100">
                 ⚠️ Se perderán todos sus GemaBits
              </p>
              
              <div className="flex gap-3">
                 <button 
                    onClick={() => setShowDeleteStudentModal(false)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-500 font-black rounded-xl transition-colors text-xs uppercase tracking-widest"
                 >
                    Cancelar
                 </button>
                 <button 
                    onClick={executeStudentDeletion}
                    disabled={actionLoading}
                    className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-xl transition-colors shadow-lg shadow-red-200 text-xs uppercase tracking-widest flex items-center justify-center gap-2 border-b-4 border-red-800 active:border-b-0 active:translate-y-1"
                 >
                    {actionLoading ? <RefreshCw className="animate-spin" size={16}/> : 'BORRAR AHORA'}
                 </button>
              </div>
           </div>
        </div>
      )}

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
                    <div className="text-[9px] text-slate-500 font-bold mt-0.5 flex items-center gap-1">
                      <img src="https://i.ibb.co/VY6QpY56/supergemabit.png" className="w-2.5 h-2.5" /> {Math.floor(s.balance/100)} GB
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
                            Total: {Math.floor(activeStudentData.balance / 100)} GemaBits
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

      {/* MODAL GESTIONAR ALUMNO */}
      {showManageModal && studentToManage && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-[100] backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2.5rem] max-w-md w-full p-8 border-b-[10px] border-slate-200 shadow-2xl relative">
            <button onClick={() => { setShowManageModal(false); setStudentToManage(null); }} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"><X size={24}/></button>
            <div className="text-center mb-8">
               <div className="w-20 h-20 rounded-full border-4 border-slate-50 mx-auto mb-3 overflow-hidden shadow-sm bg-slate-100">
                  <img src={studentToManage.avatar} className="w-full h-full object-cover"/>
               </div>
               <h3 className="font-black text-2xl text-slate-800">Gestionar Alumno</h3>
               <p className="text-slate-400 font-bold text-sm">@{studentToManage.username} • {studentToManage.displayName}</p>
            </div>
            
            <div className="space-y-6">
               <div className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-100">
                  <h4 className="font-black text-slate-700 flex items-center gap-2 mb-4 text-sm"><KeyRound size={18} className="text-amber-500" /> Nueva Contraseña</h4>
                  <form onSubmit={handleAdminResetPass} className="space-y-3">
                     <input required type="text" value={newStudentPass} onChange={e => setNewStudentPass(e.target.value)} placeholder="Ej: 123456" className="w-full bg-white border-2 border-slate-200 rounded-2xl p-4 font-bold text-slate-700 focus:border-amber-500 outline-none text-xs"/>
                     <button disabled={actionLoading} className="w-full bg-amber-500 text-white font-black py-4 rounded-2xl border-b-4 border-amber-700 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50 text-[10px] uppercase tracking-widest shadow-lg shadow-amber-100">Restablecer Clave</button>
                  </form>
               </div>
               
               <div className="bg-red-50 p-6 rounded-3xl border-2 border-red-100">
                  <h4 className="font-black text-red-700 flex items-center gap-2 mb-2 text-sm"><Trash2 size={18} /> Eliminar Alumno</h4>
                  <p className="text-[10px] font-bold text-red-400 uppercase mb-3">Esta acción eliminará todos sus datos.</p>
                  <div className="space-y-3">
                     <input type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="Escribe 'ELIMINAR'" className="w-full bg-white border-2 border-red-100 rounded-2xl p-4 font-bold text-red-700 focus:border-red-500 outline-none text-[10px]"/>
                     <button disabled={actionLoading} onClick={handleRequestDeleteStudent} className="w-full bg-red-500 text-white font-black py-4 rounded-2xl border-b-4 border-red-700 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-30 text-[10px] uppercase tracking-widest">Eliminar Alumno</button>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CREAR JUEGO */}
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
                  { id: 'TEXT', icon: <MessageCircleQuestion size={20}/>, label: 'Pregunta', color: 'bg-sky-500' },
                  { id: 'SENTENCE', icon: <Puzzle size={20}/>, label: 'Frase', color: 'bg-orange-500' },
                  { id: 'SORTING', icon: <Layers size={20}/>, label: 'Categoría', color: 'bg-violet-500' },
                  { id: 'BALANCE', icon: <Scale size={20}/>, label: 'Ahorro', color: 'bg-emerald-500' },
                  { id: 'ORDERING', icon: <ListOrdered size={20}/>, label: 'Pasos', color: 'bg-pink-500' },
                ].map(t => (
                  <button 
                    key={t.id} 
                    type="button" 
                    onClick={() => setQuizType(t.id as QuizType)}
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
                <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest pl-2">Instrucción / Pregunta</label>
                <textarea required rows={2} value={question} onChange={e => setQuestion(e.target.value)} className="w-full bg-slate-100 border-2 border-slate-200 rounded-2xl p-4 font-bold text-slate-700 focus:border-violet-500 focus:bg-white focus:outline-none transition-all resize-none" placeholder="Escribe aquí la consigna..." />
              </div>

              {/* OPCIONES DINÁMICAS SEGÚN TIPO */}
              <div className="bg-slate-50 p-6 rounded-[2rem] border-2 border-slate-100 space-y-4">
                {quizType === 'TEXT' && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Opciones de respuesta</p>
                    {textOptions.map((opt, i) => (
                      <div key={i} className="relative">
                        <input placeholder={`Opción ${i+1}`} value={opt} onChange={e => { const newOpts = [...textOptions]; newOpts[i] = e.target.value; setTextOptions(newOpts); }} className={`w-full bg-white border-2 rounded-xl p-3 pr-10 text-sm font-bold transition-all ${correctIndex === i ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 focus:border-violet-300'}`} />
                        <button type="button" onClick={() => setCorrectIndex(i)} className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${correctIndex === i ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-300'}`}><Check size={14} strokeWidth={4}/></button>
                      </div>
                    ))}
                  </div>
                )}

                {(quizType === 'SENTENCE' || quizType === 'ORDERING') && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{quizType === 'SENTENCE' ? 'Palabras de la frase (En orden correcto)' : 'Pasos (En orden correcto)'}</p>
                    <div className="space-y-2">
                      {gameItems.map((item, i) => (
                        <div key={i} className="flex gap-2">
                          <input value={item} onChange={e => { const newItems = [...gameItems]; newItems[i] = e.target.value; setGameItems(newItems); }} className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 text-sm font-bold focus:border-violet-300 transition-all" placeholder={quizType === 'SENTENCE' ? "Palabra" : "Paso"} />
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={() => setGameItems([...gameItems, ''])} className="text-[10px] font-black text-violet-500 hover:text-violet-700 flex items-center gap-1.5 px-3 py-1.5 bg-violet-50 rounded-lg w-fit mt-2 border border-violet-100 shadow-sm"><Plus size={14} strokeWidth={4}/> AGREGAR</button>
                  </div>
                )}

                {quizType === 'BALANCE' && (
                  <div className="space-y-3">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Precio objetivo a ahorrar</p>
                    <div className="relative">
                      <input type="number" value={targetValue} onChange={e => setTargetValue(Number(e.target.value))} className="w-full bg-white border-2 border-slate-200 rounded-2xl p-4 font-black text-slate-700 text-2xl focus:border-emerald-400 transition-all pr-12" />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-300">MB</span>
                    </div>
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

      {/* PESTAÑA SOLICITUDES */}
      {activeTab === 'APPROVALS' && (
        <div className="grid md:grid-cols-2 gap-8 animate-fade-in">
          <div>
            <h3 className="font-black text-slate-800 text-lg mb-4 flex items-center gap-2"><UserPlus className="text-violet-500"/> Nuevas Cuentas</h3>
            {pendingUsers.length === 0 ? (
               <div className="bg-slate-50 rounded-3xl p-8 text-center border-2 border-slate-100 border-dashed text-slate-400 font-bold">Sin solicitudes pendientes.</div>
            ) : (
              <div className="space-y-3">
                 {pendingUsers.map(u => (
                    <div key={u.uid} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <img src={u.avatar} className="w-12 h-12 rounded-full bg-slate-100" />
                          <div>
                             <p className="font-black text-slate-800">{u.displayName}</p>
                             <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{u.role}</p>
                          </div>
                       </div>
                       <div className="flex gap-2">
                          <button onClick={() => handleApprove(u.uid)} className="p-2.5 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-100"><Check size={20}/></button>
                          <button onClick={() => handleReject(u.uid)} className="p-2.5 bg-rose-50 text-rose-500 rounded-xl"><X size={20}/></button>
                       </div>
                    </div>
                 ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="font-black text-slate-800 text-lg mb-4 flex items-center gap-2"><Gamepad2 className="text-orange-500"/> Cobros de Arcade</h3>
            {pendingQuizApprovals.length === 0 ? (
               <div className="bg-slate-50 rounded-3xl p-8 text-center border-2 border-slate-100 border-dashed text-slate-400 font-bold">Sin premios por cobrar.</div>
            ) : (
              <div className="space-y-3">
                 {pendingQuizApprovals.map(q => (
                    <div key={q.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3">
                       <div className="flex items-center gap-3">
                          <img src={q.studentAvatar} className="w-10 h-10 rounded-full bg-slate-100" />
                          <div className="flex-1">
                             <p className="font-black text-slate-800 text-xs">{q.studentName}</p>
                             <p className="text-[10px] font-bold text-slate-400">Completó un juego</p>
                          </div>
                          <div className="bg-amber-100 text-amber-700 px-3 py-1 rounded-lg font-black text-sm flex items-center gap-1">
                             +{q.earned} MB
                          </div>
                       </div>
                       <div className="bg-slate-50 p-2.5 rounded-xl text-[11px] font-bold text-slate-500 border border-slate-100">
                          {q.questionPreview}
                       </div>
                       <div className="flex gap-2">
                          <button onClick={() => handleApproveQuiz(q.id)} className="flex-1 py-2 bg-emerald-500 text-white rounded-xl font-black text-xs shadow-lg shadow-emerald-100">APROBAR</button>
                          <button onClick={() => handleRejectQuiz(q.id)} className="px-4 py-2 bg-rose-50 text-rose-500 rounded-xl font-black text-xs">RECHAZAR</button>
                       </div>
                    </div>
                 ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PESTAÑA SEGURIDAD */}
      {activeTab === 'SECURITY' && (
        <div className="max-w-xl mx-auto space-y-6 animate-fade-in">
           <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border-b-[8px] border-slate-200 text-center">
              <div className="w-20 h-20 bg-amber-100 text-amber-500 rounded-3xl flex items-center justify-center mx-auto mb-6">
                 <ShieldCheck size={40} />
              </div>
              <h3 className="text-2xl font-black text-slate-800 mb-2">Seguridad del Aula</h3>
              <p className="text-slate-400 font-bold text-sm mb-8">Administra el acceso de nuevos usuarios</p>

              <div className="space-y-8 text-left">
                 <div>
                    <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest pl-2">Código Especial Actual</label>
                    <div className="flex items-center gap-2 p-5 bg-slate-50 border-4 border-slate-100 rounded-3xl">
                        <KeyRound className="text-slate-300" />
                        <span className="font-mono font-black text-3xl text-slate-700 tracking-[0.3em] flex-1 text-center">{currentAccessCode}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold mt-3 pl-2 leading-tight">
                       Este es el código que los alumnos y padres deben escribir al registrarse para poder unirse a tu clase.
                    </p>
                 </div>

                 <form onSubmit={handleUpdateCode} className="pt-6 border-t border-slate-100">
                    <label className="block text-[10px] font-black text-slate-400 mb-2 uppercase tracking-widest pl-2">Cambiar Código de Acceso</label>
                    <div className="flex gap-2">
                       <input 
                         type="text" 
                         value={newAccessCode}
                         onChange={e => setNewAccessCode(e.target.value)}
                         placeholder="Nuevo código..."
                         className="flex-1 bg-white border-2 border-slate-200 rounded-2xl p-4 font-black text-slate-700 outline-none focus:border-violet-500 transition-all shadow-sm"
                       />
                       <button disabled={!newAccessCode || updatingCode} className="bg-violet-600 text-white font-black px-6 rounded-2xl shadow-lg shadow-violet-100 active:scale-95 transition-all disabled:opacity-50">
                          {updatingCode ? <RefreshCw className="animate-spin"/> : 'CAMBIAR'}
                       </button>
                    </div>
                 </form>

                 {/* SECCIÓN DE SOLUCIÓN DE PROBLEMAS SQL */}
                 <div className="mt-8 pt-8 border-t-2 border-slate-100">
                    <div className="bg-red-50 border-2 border-red-100 rounded-3xl p-5">
                       <div className="flex items-center gap-3 mb-3">
                          <div className="p-2 bg-red-100 text-red-600 rounded-xl"><Database size={20}/></div>
                          <h4 className="font-black text-slate-700 text-sm uppercase">¡IMPORTANTE! ARREGLAR BASE DE DATOS</h4>
                       </div>
                       <p className="text-xs text-slate-500 font-bold mb-4 leading-relaxed">
                          Si el botón de borrar no hace nada, ejecuta esto en Supabase.
                          <br/>
                          <strong>Esto forzará el borrado en cascada en la base de datos.</strong>
                       </p>
                       <div className="relative group">
                          <textarea 
                             readOnly 
                             className="w-full h-40 bg-slate-800 text-green-400 text-[10px] font-mono p-4 rounded-xl resize-none focus:outline-none shadow-inner"
                             value={SQL_FIX}
                          />
                          <button 
                             onClick={() => {navigator.clipboard.writeText(SQL_FIX); alert("Código copiado al portapapeles.");}}
                             className="absolute top-2 right-2 bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold backdrop-blur-sm transition-colors flex items-center gap-1"
                          >
                             <Copy size={12} /> COPIAR CÓDIGO
                          </button>
                       </div>
                       <a href="https://supabase.com/dashboard/project/_/sql" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 justify-center mt-3 text-[10px] font-black text-blue-500 hover:underline bg-blue-50 py-2 rounded-xl border border-blue-100">
                          IR AL EDITOR SQL DE SUPABASE <ExternalLink size={12}/>
                       </a>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
