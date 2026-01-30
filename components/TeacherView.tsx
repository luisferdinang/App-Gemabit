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
  Camera, Upload, Search, Download, AlertTriangle, Database, Terminal, Copy, ExternalLink
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
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(false);
  const [isCreatingQuiz, setIsCreatingQuiz] = useState(false); // Estado para evitar doble submit
  const [quizToDelete, setQuizToDelete] = useState<string | null>(null); // State for custom delete quiz modal

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
          const q = await supabaseService.getAllTeacherQuizzes();
          setTeacherQuizzes(q);
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

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreatingQuiz) return;
    setIsCreatingQuiz(true);

    const newQuiz: any = { type: quizType, question, reward: Number(reward), difficulty: 'MEDIUM', assignedTo };
    if (quizType === 'TEXT') { newQuiz.options = textOptions; newQuiz.correctIndex = Number(correctIndex); }
    else if (quizType === 'SENTENCE' || quizType === 'ORDERING') { newQuiz.gameItems = gameItems.filter(t => t.trim()).map((t, i) => ({ id: `${i}`, text: t })); }
    else if (quizType === 'BALANCE') { newQuiz.targetValue = Number(targetValue); }
    else if (quizType === 'SORTING') { newQuiz.gameItems = sortItems.filter(i => i.text.trim()).map((item, i) => ({ id: `${i}`, text: item.text, category: item.cat })); }
    
    const result = await supabaseService.createTeacherQuiz(newQuiz);
    setIsCreatingQuiz(false);

    if (result.success) {
        setShowQuizModal(false);
        loadArcadeData(); 
        resetForm();
        soundService.playSuccess();
    } else {
        alert(`Error al crear el juego: ${result.error}`);
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

  // SCRIPT SQL REVISADO PARA ELIMINAR RESTRICCIONES DE LLAVE FORÁNEA
  const SQL_FIX = `
-- ⚠️ SCRIPT NUCLEAR PARA ARREGLAR BORRADO ⚠️
-- Ejecuta esto en el SQL Editor de Supabase

-- 1. Desactivar RLS por completo en todas las tablas
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes DISABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_results DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings DISABLE ROW LEVEL SECURITY;

-- 2. Eliminar restricciones antiguas que bloquean el borrado
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_student_id_fkey;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_student_id_fkey;
ALTER TABLE quiz_results DROP CONSTRAINT IF EXISTS quiz_results_student_id_fkey;
ALTER TABLE quiz_results DROP CONSTRAINT IF EXISTS quiz_results_quiz_id_fkey;

-- 3. Recrear restricciones con borrado en cascada (ON DELETE CASCADE)
ALTER TABLE tasks ADD CONSTRAINT tasks_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE transactions ADD CONSTRAINT transactions_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE quiz_results ADD CONSTRAINT quiz_results_student_id_fkey FOREIGN KEY (student_id) REFERENCES profiles(id) ON DELETE CASCADE;
ALTER TABLE quiz_results ADD CONSTRAINT quiz_results_quiz_id_fkey FOREIGN KEY (quiz_id) REFERENCES quizzes(id) ON DELETE CASCADE;

-- 4. Dar permisos totales
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
  `;

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

                          return (
                              <div key={quiz.id} className="bg-white p-5 rounded-[2.5rem] shadow-sm border-2 border-slate-100 hover:border-violet-300 hover:shadow-xl transition-all flex flex-col group relative">
                                  
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

                                  <div className="mt-auto pt-4 border-t border-slate-50 flex items-center gap-2">
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
                                  </div>
                              </div>
                          );
                      })}
                  </div>
              )}
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

      {/* MODAL CÓMO USAR (TEACHER GUIDE) */}
      {activeTab === 'HOW_TO' && (
         <div className="max-w-3xl mx-auto animate-fade-in space-y-6 pb-12">
            <div className="bg-sky-500 text-white p-8 rounded-[2.5rem] shadow-xl border-b-[8px] border-sky-700 text-center relative overflow-hidden">
               <Lightbulb size={120} className="absolute -right-6 -bottom-6 text-sky-300 opacity-30 rotate-12" />
               <h2 className="text-3xl font-black mb-2 relative z-10">Guía de Gemabit</h2>
               <p className="font-bold text-sky-100 relative z-10">Gestiona tu aula gamificada con éxito</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
               {[
                 { icon: <Wallet className="text-emerald-500"/>, bg: 'bg-emerald-50', title: '1. Economía', desc: '100 MiniBits (MB) equivalen a 1 GemaBit (GB). Los alumnos ahorran para metas de clase.' },
                 { icon: <CheckCircle2 className="text-violet-500"/>, bg: 'bg-violet-50', title: '2. Misiones', desc: 'Tú apruebas la Escuela, los padres el Hogar. Cada tic suma puntos a su racha semanal.' },
                 { icon: <Gamepad2 className="text-orange-500"/>, bg: 'bg-orange-50', title: '3. Arcade', desc: 'Crea juegos educativos. Revisa las solicitudes de cobro para darles sus premios.' },
                 { icon: <KeyRound className="text-amber-500"/>, bg: 'bg-amber-50', title: '4. Seguridad', desc: 'Protege tu aula cambiando el Código Especial en la pestaña Seguridad.' }
               ].map((step, idx) => (
                 <div key={idx} className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-sm flex flex-col gap-3">
                    <div className={`w-12 h-12 ${step.bg} rounded-2xl flex items-center justify-center`}>{step.icon}</div>
                    <h3 className="font-black text-lg text-slate-800">{step.title}</h3>
                    <p className="text-xs font-bold text-slate-500 leading-relaxed">{step.desc}</p>
                 </div>
               ))}
            </div>
         </div>
      )}
    </div>
  );
};
