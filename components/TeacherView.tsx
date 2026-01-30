import React, { useState, useEffect, useMemo, useRef } from 'react';
import { User, StudentReport, QuizType, QuizResult, Quiz } from '../types';
import { supabaseService, getCurrentWeekId } from '../services/supabaseService';
import { TaskController } from './TaskController';
import { PARENT_AVATARS } from './RoleSelector';
import { User as UserIcon, Check, X, ShieldAlert, BarChart3, Plus, BrainCircuit, School, Home, Trophy, Gamepad2, RefreshCw, Lock, ShieldCheck, KeyRound, UserPlus, Settings, Trash2, Calendar, ChevronDown, CheckCircle2, Clock, MessageCircleQuestion, Puzzle, Layers, Scale, ListOrdered, Projector, PartyPopper, Lightbulb, ArrowRight, ArrowLeft, Star, ShoppingBag, Smartphone, Repeat, PiggyBank, TrendingUp, Wallet, LayoutGrid, Timer, Camera, Upload, Search, Download } from 'lucide-react';
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
  const [studentArcadeHistory, setStudentArcadeHistory] = useState<QuizResult[]>([]);
  const [studentPendingQuizzes, setStudentPendingQuizzes] = useState<Quiz[]>([]);

  // Arcade Management State
  const [teacherQuizzes, setTeacherQuizzes] = useState<Quiz[]>([]);
  const [isLoadingQuizzes, setIsLoadingQuizzes] = useState(false);

  // Presentation Mode State
  const [presentationStudent, setPresentationStudent] = useState<User | null>(null);
  const [slideIndex, setSlideIndex] = useState(0); 

  // Management Modal State
  const [showManageModal, setShowManageModal] = useState(false);
  const [studentToManage, setStudentToManage] = useState<User | null>(null);
  const [newStudentPass, setNewStudentPass] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Security State
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityError, setSecurityError] = useState('');
  const [securitySuccess, setSecuritySuccess] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

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
    
    const subscription = supabaseService.subscribeToChanges('profiles', undefined, () => {
        loadData();
    });
    const quizSub = supabaseService.subscribeToChanges('quiz_results', undefined, () => {
        loadData(); // Reload pending approvals
    });

    return () => {
        subscription.unsubscribe();
        quizSub.unsubscribe();
    };
  }, [activeTab]);

  useEffect(() => {
    if (selectedStudent) {
       loadStudentDetails(selectedStudent);
    }
  }, [selectedStudent]);

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
      const history = await supabaseService.getStudentArcadeResults(uid);
      setStudentArcadeHistory(history);
      const quizData = await supabaseService.getStudentQuizzes(uid);
      setStudentPendingQuizzes(quizData.available);
  };
  
  const handleStudentUpdate = () => {
      loadData();
      if (selectedStudent) loadStudentDetails(selectedStudent);
  };

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
        alert('¡Código de Registro actualizado con éxito!');
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
    } else {
        alert("Error: " + result.error);
    }
  };

  const handleDeleteStudent = async () => {
    if (!studentToManage || deleteConfirm !== 'ELIMINAR') return;
    if (!confirm(`¿Seguro que quieres borrar a ${studentToManage.displayName}? Se perderán todos sus datos.`)) return;
    setActionLoading(true);
    const success = await supabaseService.deleteStudent(studentToManage.uid);
    setActionLoading(false);
    if (success) {
        alert("Alumno eliminado.");
        setShowManageModal(false);
        setSelectedStudent(null);
        loadData();
    }
  };

  const handleApprove = async (uid: string) => { await supabaseService.approveUser(uid); loadData(); };
  const handleReject = async (uid: string) => { await supabaseService.rejectUser(uid); loadData(); };
  const handleApproveQuiz = async (id: string) => { await supabaseService.approveQuizRedemption(id); loadData(); if(selectedStudent) loadStudentDetails(selectedStudent); };
  const handleRejectQuiz = async (id: string) => { await supabaseService.rejectQuizRedemption(id); loadData(); if(selectedStudent) loadStudentDetails(selectedStudent); };

  const handleCreateQuiz = async (e: React.FormEvent) => {
    e.preventDefault();
    const newQuiz: any = { type: quizType, question, reward: Number(reward), difficulty: 'MEDIUM', assignedTo, created_by: 'TEACHER' };
    if (quizType === 'TEXT') { newQuiz.options = textOptions; newQuiz.correctIndex = Number(correctIndex); }
    else if (quizType === 'SENTENCE' || quizType === 'ORDERING') { newQuiz.gameItems = gameItems.filter(t => t.trim()).map((t, i) => ({ id: `${i}`, text: t })); }
    else if (quizType === 'BALANCE') { newQuiz.targetValue = Number(targetValue); }
    else if (quizType === 'SORTING') { newQuiz.gameItems = sortItems.filter(i => i.text.trim()).map((item, i) => ({ id: `${i}`, text: item.text, category: item.cat })); }
    
    await supabaseService.createTeacherQuiz(newQuiz);
    setShowQuizModal(false);
    loadArcadeData(); 
    if (assignedTo !== 'ALL' && selectedStudent === assignedTo) loadStudentDetails(selectedStudent);
    alert('Juego creado.');
    resetForm();
  };

  const handleDeleteQuiz = async (quizId: string) => {
      if(confirm('¿Eliminar este juego permanentemente?')) {
          await supabaseService.deleteQuiz(quizId);
          loadArcadeData();
          if (selectedStudent) loadStudentDetails(selectedStudent);
      }
  };

  const resetForm = () => { setQuestion(''); setReward(50); setQuizType('TEXT'); setTextOptions(['', '', '']); setCorrectIndex(0); setGameItems(['', '', '']); setSortItems([{text: '', cat: 'NEED'}, {text: '', cat: 'WANT'}]); setAssignedTo('ALL'); };
  const getGems = (balance: number) => Math.floor(balance / 100);
  const formatWeek = (weekId: string) => {
      const parts = weekId.split('-W');
      return parts.length === 2 ? `Semana ${parts[1]}, ${parts[0]}` : weekId;
  };

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

  return (
    <div>
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
        <div className="flex items-center gap-4">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Panel de Maestra</h2>
        </div>
        
        <div className="bg-slate-200/60 p-1.5 rounded-2xl flex overflow-x-auto max-w-full shadow-inner backdrop-blur-sm">
           <button onClick={() => setActiveTab('STUDENTS')} className={`px-5 py-2.5 rounded-xl font-black text-sm transition-all whitespace-nowrap ${activeTab === 'STUDENTS' ? 'bg-white text-violet-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>Mis Alumnos</button>
           <button onClick={() => setActiveTab('ARCADE')} className={`px-5 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'ARCADE' ? 'bg-white text-violet-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}><LayoutGrid size={16} strokeWidth={3} /> Juegos</button>
           <button onClick={() => setActiveTab('REPORTS')} className={`px-5 py-2.5 rounded-xl font-black text-sm transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'REPORTS' ? 'bg-white text-violet-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}><BarChart3 size={16} strokeWidth={3} /> Informe</button>
           <button onClick={() => setActiveTab('APPROVALS')} className={`px-5 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'APPROVALS' ? 'bg-white text-violet-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>Solicitudes {(pendingUsers.length + pendingQuizApprovals.length) > 0 && <span className="bg-red-500 text-white text-[10px] px-2 py-0.5 rounded-full shadow-sm">{pendingUsers.length + pendingQuizApprovals.length}</span>}</button>
           <button onClick={() => setActiveTab('SECURITY')} className={`px-5 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'SECURITY' ? 'bg-white text-violet-600 shadow-md' : 'text-slate-500 hover:text-slate-700'}`}>Seguridad</button>
           <div className="w-px bg-slate-300 mx-2 my-1"></div>
           <button onClick={() => setActiveTab('HOW_TO')} className={`px-5 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'HOW_TO' ? 'bg-sky-500 text-white shadow-md' : 'bg-slate-300 text-slate-500 hover:text-slate-600 hover:bg-slate-400'}`}><Lightbulb size={16} strokeWidth={3} /> CÓMO</button>
           <button onClick={() => setActiveTab('PRESENTATION')} className={`px-5 py-2.5 rounded-xl font-black text-sm flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'PRESENTATION' ? 'bg-slate-800 text-yellow-400 shadow-md' : 'bg-slate-300 text-slate-500 hover:text-slate-600 hover:bg-slate-400'}`}><Projector size={16} strokeWidth={3} /> CIERRE</button>
        </div>
      </div>

      {/* PESTAÑA ARCADE */}
      {activeTab === 'ARCADE' && (
          <div className="space-y-8 animate-fade-in">
              <div className="bg-gradient-to-br from-violet-600 to-indigo-700 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl border-b-[8px] border-violet-900/50 flex flex-col md:flex-row justify-between items-center gap-8">
                  <div className="relative z-10 text-center md:text-left">
                      <h2 className="text-4xl font-black mb-3 flex items-center justify-center md:justify-start gap-4 tracking-tight">
                          <Gamepad2 size={48} className="text-yellow-400 animate-float" />
                          Arcade de la Clase
                      </h2>
                      <p className="text-violet-100 font-bold opacity-90 max-w-lg text-lg leading-snug">
                          Crea desafíos educativos personalizados. ¡Aprender finanzas jugando es la clave del éxito!
                      </p>
                  </div>
                  <div className="relative z-10 w-full md:w-auto">
                      <button 
                        onClick={() => { setAssignedTo('ALL'); setShowQuizModal(true); }}
                        className="w-full bg-yellow-400 hover:bg-yellow-300 text-yellow-900 px-10 py-5 rounded-[1.5rem] font-black text-xl shadow-xl border-b-[6px] border-yellow-600 active:border-b-0 active:translate-y-1.5 transition-all flex items-center justify-center gap-3"
                      >
                          <Plus size={28} strokeWidth={4} /> Crear Juego
                      </button>
                  </div>
                  <div className="absolute top-0 right-0 w-80 h-80 bg-white/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              </div>

              <div className="flex justify-between items-center px-4">
                  <div className="flex items-center gap-2">
                      <h3 className="font-black text-slate-400 text-xs uppercase tracking-widest">Lista de Juegos</h3>
                      <span className="bg-slate-100 text-slate-500 px-3 py-1 rounded-full text-xs font-black">{teacherQuizzes.length}</span>
                  </div>
                  <button onClick={loadArcadeData} disabled={isLoadingQuizzes} className="p-2.5 text-slate-400 hover:text-violet-600 bg-white border-2 border-slate-100 rounded-xl transition-all disabled:opacity-50">
                      <RefreshCw size={20} className={isLoadingQuizzes ? 'animate-spin' : ''} />
                  </button>
              </div>

              {isLoadingQuizzes ? (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-60 pointer-events-none">
                      {[1,2,3].map(i => <div key={i} className="bg-slate-100 h-48 rounded-[2rem] animate-pulse"></div>)}
                  </div>
              ) : teacherQuizzes.length === 0 ? (
                  <div className="col-span-full text-center py-24 bg-white rounded-[3rem] border-4 border-dashed border-slate-200 shadow-inner">
                      <div className="inline-block p-8 bg-slate-50 rounded-full mb-6 text-slate-300"><BrainCircuit size={80} strokeWidth={1.5} /></div>
                      <h4 className="text-2xl font-black text-slate-400 mb-2">¡Tu Arcade está vacío!</h4>
                  </div>
              ) : (
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {teacherQuizzes.map(quiz => {
                          const visuals = getGameVisual(quiz.type);
                          const assignedStudent = quiz.assignedTo !== 'ALL' ? students.find(s => s.uid === quiz.assignedTo) : null;
                          return (
                              <div key={quiz.id} className="bg-white p-6 rounded-[2.5rem] shadow-sm border-2 border-slate-100 hover:border-violet-300 hover:shadow-xl hover:shadow-violet-100 transition-all flex flex-col h-full relative group">
                                  <div className="flex justify-between items-start mb-4">
                                      <div className={`p-3 rounded-[1rem] ${visuals.bg} ${visuals.color} border ${visuals.border} shadow-sm`}>{visuals.icon}</div>
                                      <div className="flex items-center gap-2">
                                          <div className="bg-yellow-400 text-yellow-900 px-3 py-1.5 rounded-xl text-xs font-black shadow-sm flex items-center gap-1.5 border-b-2 border-yellow-600"><img src="https://i.ibb.co/JWvYtPhJ/minibit-1.png" className="w-3.5 h-3.5" /> +{quiz.reward}</div>
                                          <button onClick={() => handleDeleteQuiz(quiz.id)} className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18} /></button>
                                      </div>
                                  </div>
                                  <div className="mb-2"><span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg ${visuals.bg} ${visuals.color}`}>{visuals.label}</span></div>
                                  <h4 className="font-black text-slate-800 text-lg leading-tight mb-6 line-clamp-3">{quiz.question}</h4>
                                  <div className="mt-auto pt-5 border-t-2 border-slate-50 flex items-center gap-2">
                                      {quiz.assignedTo === 'ALL' ? (
                                          <div className="flex items-center gap-2 text-xs font-black text-sky-600 bg-sky-50 px-4 py-2 rounded-xl w-full border border-sky-100 shadow-sm"><Star size={16} className="text-sky-500 fill-sky-500" /> PARA TODA LA CLASE</div>
                                      ) : (
                                          <div className="flex items-center gap-3 text-xs font-black text-violet-600 bg-violet-50 px-4 py-2 rounded-xl w-full border border-violet-100 shadow-sm">
                                              <div className="w-6 h-6 rounded-full bg-white border-2 border-violet-200 overflow-hidden shrink-0"><img src={assignedStudent?.avatar || ''} className="w-full h-full object-cover" /></div>
                                              <span className="truncate">ESPECÍFICO: {assignedStudent?.displayName.toUpperCase() || 'DESCONOCIDO'}</span>
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

      {/* APPROVALS TAB */}
      {activeTab === 'APPROVALS' && (
        <div className="grid md:grid-cols-2 gap-8 animate-fade-in">
          <div>
            <h3 className="font-black text-slate-800 text-xl mb-4 flex items-center gap-2"><UserPlus className="text-violet-500"/> Registro de Usuarios</h3>
            {pendingUsers.length === 0 ? (
               <div className="bg-slate-100 rounded-3xl p-8 text-center border-2 border-slate-200 border-dashed"><span className="text-slate-400 font-bold text-sm">No hay solicitudes de registro.</span></div>
            ) : (
              <div className="space-y-3">
                 {pendingUsers.map(u => (
                    <div key={u.uid} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between">
                       <div className="flex items-center gap-3">
                          <img src={u.avatar} className="w-12 h-12 rounded-full bg-slate-100" />
                          <div>
                             <p className="font-black text-slate-800">{u.displayName}</p>
                             <p className="text-xs font-bold text-slate-400">@{u.username} • {u.role}</p>
                          </div>
                       </div>
                       <div className="flex gap-2">
                          <button onClick={() => handleApprove(u.uid)} className="p-2 bg-emerald-100 text-emerald-600 rounded-xl hover:bg-emerald-200"><Check size={20}/></button>
                          <button onClick={() => handleReject(u.uid)} className="p-2 bg-rose-100 text-rose-600 rounded-xl hover:bg-rose-200"><X size={20}/></button>
                       </div>
                    </div>
                 ))}
              </div>
            )}
          </div>

          <div>
            <h3 className="font-black text-slate-800 text-xl mb-4 flex items-center gap-2"><Gamepad2 className="text-orange-500"/> Cobro de Arcade</h3>
            {pendingQuizApprovals.length === 0 ? (
               <div className="bg-slate-100 rounded-3xl p-8 text-center border-2 border-slate-200 border-dashed"><span className="text-slate-400 font-bold text-sm">No hay solicitudes de cobro.</span></div>
            ) : (
              <div className="space-y-3">
                 {pendingQuizApprovals.map(q => (
                    <div key={q.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex flex-col gap-3">
                       <div className="flex items-center gap-3">
                          <img src={q.studentAvatar} className="w-10 h-10 rounded-full bg-slate-100" />
                          <div>
                             <p className="font-black text-slate-800 text-sm">{q.studentName}</p>
                             <p className="text-xs font-bold text-slate-400">Solicita Cobrar</p>
                          </div>
                          <div className="ml-auto bg-amber-100 text-amber-700 px-3 py-1 rounded-lg font-black text-sm flex items-center gap-1">
                             +{q.earned} <img src="https://i.ibb.co/JWvYtPhJ/minibit-1.png" className="w-3 h-3" />
                          </div>
                       </div>
                       <div className="bg-slate-50 p-3 rounded-xl text-xs font-bold text-slate-600 border border-slate-200">
                          {q.questionPreview}
                       </div>
                       <div className="flex gap-2">
                          <button onClick={() => handleApproveQuiz(q.id)} className="flex-1 py-2 bg-emerald-500 text-white rounded-xl font-bold text-xs hover:bg-emerald-600 shadow-sm border-b-4 border-emerald-700 active:border-b-0 active:translate-y-1 transition-all">APROBAR</button>
                          <button onClick={() => handleRejectQuiz(q.id)} className="px-4 py-2 bg-rose-100 text-rose-600 rounded-xl font-bold text-xs hover:bg-rose-200">RECHAZAR</button>
                       </div>
                    </div>
                 ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* REPORTS TAB */}
      {activeTab === 'REPORTS' && (
        <div className="animate-fade-in space-y-6">
           <div className="bg-white p-6 rounded-[2rem] shadow-sm border-2 border-slate-100">
              <h3 className="font-black text-xl text-slate-800 mb-6 flex items-center gap-2"><BarChart3 className="text-violet-500"/> Progreso Semanal de la Clase</h3>
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead>
                       <tr className="border-b-2 border-slate-100 text-xs font-black text-slate-400 uppercase tracking-wider">
                          <th className="pb-4 pl-4">Alumno</th>
                          <th className="pb-4">Escuela (Tareas)</th>
                          <th className="pb-4">Casa (Tareas)</th>
                          <th className="pb-4 text-right pr-4">Saldo Total</th>
                       </tr>
                    </thead>
                    <tbody className="text-sm font-bold text-slate-600">
                       {reports.map((r, i) => (
                          <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                             <td className="py-4 pl-4 flex items-center gap-3">
                                <img src={r.student.avatar} className="w-8 h-8 rounded-full bg-slate-100" />
                                <span>{r.student.displayName}</span>
                             </td>
                             <td className="py-4">
                                <div className="flex items-center gap-2 w-32">
                                   <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                      <div className="h-full bg-violet-500 rounded-full" style={{width: `${(r.schoolTasksCompleted/Math.max(r.schoolTasksTotal, 1))*100}%`}}></div>
                                   </div>
                                   <span className="text-xs text-violet-500">{r.schoolTasksCompleted}/{r.schoolTasksTotal}</span>
                                </div>
                             </td>
                             <td className="py-4">
                                <div className="flex items-center gap-2 w-32">
                                   <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                                      <div className="h-full bg-emerald-500 rounded-full" style={{width: `${(r.homeTasksCompleted/Math.max(r.homeTasksTotal, 1))*100}%`}}></div>
                                   </div>
                                   <span className="text-xs text-emerald-500">{r.homeTasksCompleted}/{r.homeTasksTotal}</span>
                                </div>
                             </td>
                             <td className="py-4 text-right pr-4 font-black text-slate-800">
                                {getGems(r.student.balance)} GB • {r.student.balance % 100} MB
                             </td>
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}
      
      {/* SECURITY TAB */}
      {activeTab === 'SECURITY' && (
        <div className="max-w-xl mx-auto space-y-8 animate-fade-in">
           <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border-b-[8px] border-slate-200">
              <div className="text-center mb-8">
                 <div className="w-20 h-20 bg-amber-100 text-amber-500 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-lg">
                    <ShieldCheck size={40} />
                 </div>
                 <h3 className="text-2xl font-black text-slate-800">Centro de Seguridad</h3>
                 <p className="text-slate-400 font-bold text-sm">Protege el acceso a tu aula</p>
              </div>

              <div className="space-y-6">
                 <div>
                    <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest pl-2">Código de Registro Actual</label>
                    <div className="flex items-center gap-2 p-4 bg-slate-50 border-2 border-slate-100 rounded-2xl">
                        <KeyRound className="text-slate-300" />
                        <span className="font-mono font-black text-2xl text-slate-700 tracking-widest flex-1 text-center">{currentAccessCode}</span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold mt-2 pl-2">
                       Comparte este código SOLO con los padres y alumnos para que puedan crear sus cuentas.
                    </p>
                 </div>

                 <form onSubmit={handleUpdateCode} className="pt-4 border-t-2 border-slate-50">
                    <label className="block text-xs font-black text-slate-400 mb-2 uppercase tracking-widest pl-2">Cambiar Código</label>
                    <div className="flex gap-2">
                       <input 
                         type="text" 
                         value={newAccessCode}
                         onChange={e => setNewAccessCode(e.target.value)}
                         placeholder="Nuevo código secreto"
                         className="flex-1 bg-white border-2 border-slate-200 rounded-2xl p-4 font-bold text-slate-700 outline-none focus:border-violet-500 transition-all"
                       />
                       <button disabled={!newAccessCode || updatingCode} className="bg-violet-600 text-white font-black px-6 rounded-2xl hover:bg-violet-500 active:scale-95 transition-all disabled:opacity-50">
                          {updatingCode ? <RefreshCw className="animate-spin"/> : 'Guardar'}
                       </button>
                    </div>
                 </form>
              </div>
           </div>
        </div>
      )}

      {/* HOW TO TAB */}
      {activeTab === 'HOW_TO' && (
         <div className="max-w-3xl mx-auto animate-fade-in space-y-8 pb-12">
            <div className="bg-sky-500 text-white p-8 rounded-[2.5rem] shadow-xl border-b-[8px] border-sky-700 text-center relative overflow-hidden">
               <Lightbulb size={120} className="absolute -right-6 -bottom-6 text-sky-300 opacity-50 rotate-12" />
               <h2 className="text-3xl font-black mb-2 relative z-10">¿Cómo Funciona Gemabit?</h2>
               <p className="font-bold text-sky-100 relative z-10">Guía rápida para la Maestra</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
               <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-sm">
                  <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mb-4"><Wallet size={24}/></div>
                  <h3 className="font-black text-lg text-slate-800 mb-2">1. La Economía</h3>
                  <p className="text-sm font-bold text-slate-500 leading-relaxed">
                     La moneda se llama <span className="text-emerald-500">GemaBit (GB)</span>.
                     <br/>
                     100 MiniBits (MB) = 1 GemaBit.
                     <br/>
                     Los alumnos ganan MB completando tareas y jugando en el Arcade.
                  </p>
               </div>
               
               <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-sm">
                  <div className="w-12 h-12 bg-violet-100 text-violet-600 rounded-2xl flex items-center justify-center mb-4"><CheckCircle2 size={24}/></div>
                  <h3 className="font-black text-lg text-slate-800 mb-2">2. Las Tareas</h3>
                  <p className="text-sm font-bold text-slate-500 leading-relaxed">
                     Hay tareas de <strong>Escuela</strong> (tú las apruebas) y de <strong>Casa</strong> (los padres las aprueban).
                     <br/>
                     Cada tarea completada suma puntos a la barra de energía semanal del alumno.
                  </p>
               </div>

               <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-sm">
                  <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-2xl flex items-center justify-center mb-4"><Gamepad2 size={24}/></div>
                  <h3 className="font-black text-lg text-slate-800 mb-2">3. El Arcade</h3>
                  <p className="text-sm font-bold text-slate-500 leading-relaxed">
                     Crea juegos educativos (preguntas, ordenar frases, matemáticas).
                     <br/>
                     Los alumnos juegan para ganar MB extra. Tú debes aprobar sus ganancias en la pestaña "Solicitudes".
                  </p>
               </div>

               <div className="bg-white p-6 rounded-[2rem] border-2 border-slate-100 shadow-sm">
                  <div className="w-12 h-12 bg-pink-100 text-pink-600 rounded-2xl flex items-center justify-center mb-4"><Trophy size={24}/></div>
                  <h3 className="font-black text-lg text-slate-800 mb-2">4. Super GemaBit</h3>
                  <p className="text-sm font-bold text-slate-500 leading-relaxed">
                     Si un alumno completa todas sus tareas durante 4 semanas seguidas, gana el trofeo Super GemaBit y una gran recompensa.
                  </p>
               </div>
            </div>
         </div>
      )}

      {/* PRESENTATION TAB */}
      {activeTab === 'PRESENTATION' && (
         <div className="animate-fade-in flex flex-col items-center justify-center min-h-[60vh]">
            {!presentationStudent ? (
               <div className="text-center space-y-8 max-w-2xl">
                  <h2 className="text-3xl font-black text-slate-800">Modo Presentación</h2>
                  <p className="text-slate-400 font-bold">Selecciona un alumno para proyectar sus logros a la clase.</p>
                  
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                     {students.map(s => (
                        <button 
                           key={s.uid} 
                           onClick={() => setPresentationStudent(s)}
                           className="flex flex-col items-center gap-2 p-4 bg-white rounded-3xl border-2 border-slate-100 hover:border-violet-500 hover:scale-110 transition-all shadow-sm group"
                        >
                           <img src={s.avatar} className="w-16 h-16 rounded-full bg-slate-100 group-hover:shadow-lg transition-all" />
                           <span className="font-black text-xs text-slate-600">{s.displayName.split(' ')[0]}</span>
                        </button>
                     ))}
                  </div>
               </div>
            ) : (
               <div className="w-full max-w-4xl relative">
                  <button 
                    onClick={() => setPresentationStudent(null)}
                    className="absolute top-0 left-0 p-3 bg-white rounded-full shadow-lg z-20 hover:bg-slate-50 border-2 border-slate-100 text-slate-400"
                  >
                     <ArrowLeft size={24} />
                  </button>

                  <div className="bg-slate-900 text-white rounded-[3rem] p-12 text-center relative overflow-hidden shadow-2xl border-[10px] border-slate-800">
                      {/* Background Effects */}
                      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                         <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-violet-600 rounded-full blur-[100px] opacity-30 animate-pulse"></div>
                         <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-600 rounded-full blur-[100px] opacity-30 animate-pulse delay-700"></div>
                      </div>

                      <div className="relative z-10 flex flex-col items-center">
                          <div className="w-40 h-40 rounded-full border-8 border-white/10 p-1 mb-6 shadow-2xl relative">
                             <img src={presentationStudent.avatar} className="w-full h-full rounded-full object-cover bg-slate-800" />
                             <div className="absolute -bottom-4 bg-yellow-400 text-yellow-900 px-4 py-1 rounded-full font-black text-sm border-2 border-yellow-200 shadow-lg flex items-center gap-1">
                                <Trophy size={16} /> Nivel {Math.floor(presentationStudent.xp / 100) + 1}
                             </div>
                          </div>
                          
                          <h1 className="text-5xl font-black mb-2 tracking-tight">{presentationStudent.displayName}</h1>
                          <p className="text-slate-400 font-bold text-xl mb-10">Resumen de Progreso</p>

                          <div className="grid grid-cols-3 gap-8 w-full max-w-2xl">
                              <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/10 flex flex-col items-center">
                                  <span className="text-4xl font-black text-emerald-400 mb-2">{getGems(presentationStudent.balance)}</span>
                                  <span className="text-xs font-bold uppercase tracking-widest opacity-60">GemaBits</span>
                              </div>
                              <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/10 flex flex-col items-center">
                                  <span className="text-4xl font-black text-violet-400 mb-2">{presentationStudent.streakWeeks}</span>
                                  <span className="text-xs font-bold uppercase tracking-widest opacity-60">Sem. Racha</span>
                              </div>
                              <div className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/10 flex flex-col items-center">
                                  <span className="text-4xl font-black text-sky-400 mb-2">{Math.floor(presentationStudent.balance % 100)}</span>
                                  <span className="text-xs font-bold uppercase tracking-widest opacity-60">MiniBits</span>
                              </div>
                          </div>

                          <div className="mt-12 animate-bounce-slow">
                              <span className="bg-gradient-to-r from-yellow-300 to-yellow-500 text-yellow-900 px-8 py-3 rounded-full font-black text-lg shadow-lg shadow-yellow-500/20">
                                 ¡Sigue así! 🚀
                              </span>
                          </div>
                      </div>
                  </div>
               </div>
            )}
         </div>
      )}

      {/* QUIZ MODAL */}
      {showQuizModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in"><div className="bg-white rounded-[2.5rem] max-w-lg w-full p-6 md:p-8 border-b-[10px] border-slate-200 shadow-2xl max-h-[95vh] overflow-y-auto relative"><div className="flex justify-between items-center mb-8"><h3 className="font-black text-2xl text-slate-800 flex items-center gap-3"><div className="p-2.5 bg-violet-100 text-violet-600 rounded-xl"><BrainCircuit size={28} /></div> Nuevo Juego Arcade</h3><button onClick={() => setShowQuizModal(false)} className="p-2.5 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"><X size={24} strokeWidth={3} /></button></div><form onSubmit={handleCreateQuiz} className="space-y-6"><div className="grid grid-cols-5 gap-2.5">{[{ id: 'TEXT', icon: <MessageCircleQuestion size={20}/>, label: 'Pregunta', color: 'bg-sky-500' },{ id: 'SENTENCE', icon: <Puzzle size={20}/>, label: 'Frase', color: 'bg-orange-500' },{ id: 'SORTING', icon: <Layers size={20}/>, label: 'Categoría', color: 'bg-violet-500' },{ id: 'BALANCE', icon: <Scale size={20}/>, label: 'Ahorro', color: 'bg-emerald-500' },{ id: 'ORDERING', icon: <ListOrdered size={20}/>, label: 'Pasos', color: 'bg-pink-500' },].map(t => (<button key={t.id} type="button" onClick={() => setQuizType(t.id as QuizType)} className={`flex flex-col items-center justify-center p-3 rounded-2xl border-2 text-[9px] font-black uppercase tracking-tighter transition-all ${quizType === t.id ? `bg-white border-violet-500 text-violet-600 shadow-lg scale-105 z-10` : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'}`}><div className={`p-2 rounded-xl mb-1.5 transition-colors ${quizType === t.id ? 'text-white ' + t.color : 'text-slate-300 bg-white border border-slate-100'}`}>{t.icon}</div>{t.label}</button>))}</div><div><label className="block text-xs font-black text-slate-400 mb-2 uppercase pl-2 tracking-widest">Instrucción / Pregunta</label><textarea required rows={2} value={question} onChange={e => setQuestion(e.target.value)} className="w-full bg-slate-100 border-2 border-slate-200 rounded-[1.2rem] p-4 font-bold text-slate-700 focus:border-violet-500 focus:bg-white focus:outline-none transition-all resize-none" placeholder="Escribe aquí la consigna..." /></div><div className="bg-slate-50 p-6 rounded-[1.5rem] border-2 border-slate-100 space-y-4">{quizType === 'TEXT' && (<div className="space-y-3"><p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Opciones de respuesta</p>{textOptions.map((opt, i) => (<div key={i} className="relative"><input placeholder={`Opción ${i+1}`} value={opt} onChange={e => { const newOpts = [...textOptions]; newOpts[i] = e.target.value; setTextOptions(newOpts); }} className={`w-full bg-white border-2 rounded-xl p-3 pr-10 text-sm font-bold transition-all ${correctIndex === i ? 'border-emerald-500 bg-emerald-50/50' : 'border-slate-200 focus:border-violet-300'}`} /><button type="button" onClick={() => setCorrectIndex(i)} className={`absolute right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${correctIndex === i ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-300'}`}><Check size={14} strokeWidth={4}/></button></div>))}</div>)}{(quizType === 'SENTENCE' || quizType === 'ORDERING') && (<div className="space-y-3"><p className="text-xs font-black text-slate-400 uppercase tracking-widest">{quizType === 'SENTENCE' ? 'Palabras de la frase (En orden correcto)' : 'Pasos (En orden correcto)'}</p><div className="space-y-2">{gameItems.map((item, i) => (<div key={i} className="flex gap-2 group"><span className="text-xs font-black text-slate-300 py-3 w-4">{i+1}</span><input value={item} onChange={e => { const newItems = [...gameItems]; newItems[i] = e.target.value; setGameItems(newItems); }} className="w-full bg-white border-2 border-slate-200 rounded-xl p-3 text-sm font-bold focus:border-violet-300 transition-all" placeholder={quizType === 'SENTENCE' ? "Palabra" : "Paso"} /></div>))}</div><button type="button" onClick={() => setGameItems([...gameItems, ''])} className="text-xs font-black text-violet-500 hover:text-violet-700 flex items-center gap-1.5 px-2 py-1 bg-violet-50 rounded-lg w-fit mt-2"><Plus size={14} strokeWidth={3}/> Agregar elemento</button></div>)}{quizType === 'BALANCE' && (<div className="space-y-3"><p className="text-xs font-black text-slate-400 uppercase tracking-widest">Precio objetivo a ahorrar</p><div className="relative"><input type="number" value={targetValue} onChange={e => setTargetValue(Number(e.target.value))} className="w-full bg-white border-3 border-slate-200 rounded-2xl p-4 font-black text-slate-700 text-2xl focus:border-emerald-400 transition-all pr-12" /><span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-slate-300">MB</span></div></div>)}{quizType === 'SORTING' && (<div className="space-y-3"><p className="text-xs font-black text-slate-400 uppercase tracking-widest">Items para clasificar</p><div className="space-y-2">{sortItems.map((item, i) => (<div key={i} className="flex gap-2"><input value={item.text} placeholder="Ej. Chocolate" onChange={e => { const newItems = [...sortItems]; newItems[i].text = e.target.value; setSortItems(newItems); }} className="flex-1 bg-white border-2 border-slate-200 rounded-xl p-3 text-sm font-bold focus:border-violet-300 transition-all" /><select value={item.cat} onChange={e => { const newItems = [...sortItems]; newItems[i].cat = e.target.value as 'NEED' | 'WANT'; setSortItems(newItems); }} className={`rounded-xl border-2 text-[10px] font-black p-2 outline-none uppercase tracking-tighter ${item.cat === 'NEED' ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'bg-rose-100 border-rose-300 text-rose-700'}`}><option value="NEED">Vital</option><option value="WANT">Capricho</option></select></div>))}</div><button type="button" onClick={() => setSortItems([...sortItems, {text: '', cat: 'NEED'}])} className="text-xs font-black text-violet-500 hover:text-violet-700 flex items-center gap-1.5 px-2 py-1 bg-violet-50 rounded-lg w-fit mt-2"><Plus size={14} strokeWidth={3}/> Agregar objeto</button></div>)}</div><div className="grid grid-cols-2 gap-4"><div><label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase pl-2 tracking-widest">Premio (MB)</label><div className="relative"><input type="number" min="1" max="500" value={reward} onChange={e => setReward(Number(e.target.value))} className="w-full bg-slate-100 border-2 border-slate-200 rounded-2xl p-3.5 font-black text-slate-700 focus:border-violet-500 focus:bg-white focus:outline-none transition-all" /><img src="https://i.ibb.co/JWvYtPhJ/minibit-1.png" className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 opacity-40" /></div></div><div><label className="block text-[10px] font-black text-slate-400 mb-1.5 uppercase pl-2 tracking-widest">Asignar A</label><select value={assignedTo} onChange={e => setAssignedTo(e.target.value)} className="w-full bg-slate-100 border-2 border-slate-200 rounded-2xl p-3.5 font-black text-slate-700 focus:border-violet-500 focus:bg-white focus:outline-none transition-all text-xs"><option value="ALL">⭐️ TODA LA CLASE</option>{students.map(s => (<option key={s.uid} value={s.uid}>{s.displayName.toUpperCase()}</option>))}</select></div></div><button className="w-full bg-violet-600 text-white font-black py-5 rounded-[1.5rem] border-b-[8px] border-violet-800 active:translate-y-1.5 active:border-b-0 transition-all uppercase tracking-[0.2em] mt-6 shadow-2xl shadow-violet-100 text-lg">Crear Juego</button></form></div></div>
      )}

      {/* STUDENTS TAB */}
      {activeTab === 'STUDENTS' && (
        <div className="grid md:grid-cols-4 gap-6 animate-fade-in">
          <div className="md:col-span-1 space-y-3">
            <h3 className="font-bold text-slate-400 text-xs uppercase tracking-wider mb-2">Lista de Clase</h3>
            {students.length === 0 && <p className="text-slate-400 text-sm">No hay alumnos aprobados.</p>}
            {students.map(s => (<button key={s.uid} onClick={() => setSelectedStudent(s.uid)} className={`w-full text-left p-3 rounded-2xl flex items-center justify-between border-2 transition-all ${selectedStudent === s.uid ? 'border-violet-500 bg-violet-50 shadow-md scale-105 z-10' : 'border-white bg-white hover:border-slate-200 hover:bg-slate-50'}`}><div className="flex items-center gap-3"><div className="w-10 h-10 rounded-full border-2 border-white shadow-sm overflow-hidden bg-slate-100"><img src={s.avatar} alt="Avatar" className="w-full h-full object-cover" /></div><div><div className="font-black text-slate-700 leading-tight text-sm">{s.displayName.split(' ')[0]}</div><div className="text-[10px] text-slate-500 font-bold flex items-center gap-1 mt-0.5"><img src="https://i.ibb.co/VY6QpY56/supergemabit.png" className="w-3 h-3 object-contain" /> {Math.floor(s.balance/100)} GB • {s.balance%100} MB</div></div></div></button>))}
          </div>
          <div className="md:col-span-3">
            {activeStudentData ? (
              <div className="animate-fade-in space-y-6">
                <div className="bg-white rounded-[2rem] p-6 shadow-sm border-2 border-slate-100 flex flex-col gap-6">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-4 w-full">
                      <div className="w-16 h-16 rounded-2xl bg-violet-100 p-1 shrink-0"><img src={activeStudentData.avatar} className="w-full h-full object-cover rounded-xl" /></div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-2xl text-slate-800">{activeStudentData.displayName}</h3>
                          <button onClick={() => { setStudentToManage(activeStudentData); setShowManageModal(true); }} className="p-1.5 text-slate-300 hover:text-slate-500 transition-colors"><Settings size={18}/></button>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2"><span className="text-xs font-bold bg-amber-100 text-amber-700 px-2 py-1 rounded-lg flex items-center gap-1"><Trophy size={14} className="text-amber-500"/> Nivel {Math.floor(activeStudentData.xp / 100) + 1}</span><span className="text-xs font-black bg-emerald-100 text-emerald-700 px-3 py-1 rounded-lg flex items-center gap-1 border border-emerald-200 shadow-sm"><img src="https://i.ibb.co/VY6QpY56/supergemabit.png" className="w-4 h-4 object-contain" /> Total: {getGems(activeStudentData.balance)} GemaBits</span></div>
                      </div>
                    </div>
                    <button onClick={() => { setAssignedTo(activeStudentData.uid); setShowQuizModal(true); }} className="w-full sm:w-auto bg-sky-500 text-white px-5 py-3 rounded-xl font-bold text-sm shadow-sky-200 shadow-lg hover:bg-sky-400 active:translate-y-1 transition-all flex items-center justify-center gap-2 border-b-4 border-sky-700 active:border-b-0 whitespace-nowrap"><Plus size={18} strokeWidth={3} /> Asignar Juego</button>
                  </div>
                  <div className="border-t-2 border-slate-50 pt-4">
                     <div className="flex items-center gap-3">
                         <div className="p-2 bg-slate-100 text-slate-500 rounded-lg"><Calendar size={20}/></div>
                         <div className="relative flex-1">
                             <select value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)} className="w-full appearance-none bg-slate-50 border-2 border-slate-200 rounded-xl p-3 pr-10 font-bold text-slate-700 focus:outline-none focus:border-violet-500 transition-colors cursor-pointer">
                                 {availableWeeks.map(week => (<option key={week.weekId} value={week.weekId}>{formatWeek(week.weekId)} {week.weekId === getCurrentWeekId() ? '(Actual)' : ''}</option>))}
                             </select>
                             <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                         </div>
                         {(() => {
                            const currentWeekData = availableWeeks.find(w => w.weekId === selectedWeek);
                            const completion = currentWeekData ? Math.round(currentWeekData.completion) : 0;
                            return (<div className="flex flex-col items-end"><span className={`text-xs font-black ${completion === 100 ? 'text-emerald-500' : 'text-slate-400'}`}>{completion}%</span><div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full ${completion === 100 ? 'bg-emerald-500' : 'bg-slate-300'}`} style={{width: `${completion}%`}}></div></div></div>)
                         })()}
                     </div>
                  </div>
                </div>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="bg-white rounded-[2rem] p-6 border-2 border-slate-100 relative overflow-hidden shadow-sm">
                      <div className="flex items-center gap-3 mb-6 relative z-10"><div className="p-3 bg-violet-100 text-violet-600 rounded-xl"><School size={24} strokeWidth={3} /></div><div><h3 className="font-black text-slate-700 text-lg">Evaluación Escolar</h3><p className="text-xs text-slate-400 font-bold">Semana seleccionada</p></div></div>
                      <TaskController studentId={activeStudentData.uid} allowedType="SCHOOL" weekId={selectedWeek} onUpdate={handleStudentUpdate} />
                  </div>
                  <div className="bg-slate-50 rounded-[2rem] p-6 border-2 border-slate-100 relative overflow-hidden">
                      <div className="flex items-center gap-3 mb-6 relative z-10"><div className="p-3 bg-emerald-100 text-emerald-600 rounded-xl"><Home size={24} strokeWidth={3} /></div><div><h3 className="font-black text-slate-700 text-lg">Actividad en Casa</h3><p className="text-xs text-slate-400 font-bold">Gestionado por Padres</p></div></div>
                      <TaskController studentId={activeStudentData.uid} allowedType="HOME" readOnly={true} weekId={selectedWeek} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-300 border-4 border-dashed border-slate-200 rounded-[3rem] bg-slate-50/50"><div className="bg-white p-6 rounded-full shadow-sm mb-4"><School size={48} className="text-slate-200" /></div><span className="font-black text-lg">Selecciona un alumno</span><p className="text-sm font-bold opacity-60">Para evaluar y ver detalles</p></div>
            )}
          </div>
        </div>
      )}

      {/* MANAGE STUDENT MODAL */}
      {showManageModal && studentToManage && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-[2.5rem] max-w-md w-full p-8 border-b-[10px] border-slate-200 shadow-2xl relative">
            <button onClick={() => { setShowManageModal(false); setStudentToManage(null); }} className="absolute top-6 right-6 p-2 bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"><X size={24}/></button>
            <div className="text-center mb-8"><div className="w-20 h-20 rounded-full border-4 border-slate-100 mx-auto mb-3 overflow-hidden shadow-sm"><img src={studentToManage.avatar} className="w-full h-full object-cover"/></div><h3 className="font-black text-2xl text-slate-800">Gestionar Alumno</h3><p className="text-slate-400 font-bold text-sm">@{studentToManage.username} • {studentToManage.displayName}</p></div>
            <div className="space-y-8">
               <div className="bg-slate-50 p-6 rounded-3xl border-2 border-slate-100"><h4 className="font-black text-slate-700 flex items-center gap-2 mb-4"><KeyRound size={20} className="text-amber-500" /> Nueva Contraseña</h4><form onSubmit={handleAdminResetPass} className="space-y-3"><input required type="text" value={newStudentPass} onChange={e => setNewStudentPass(e.target.value)} placeholder="Escribe la nueva clave" className="w-full bg-white border-2 border-slate-200 rounded-2xl p-3 font-bold text-slate-700 focus:border-amber-500 outline-none text-sm"/><button disabled={actionLoading} className="w-full bg-amber-500 text-white font-black py-3 rounded-2xl border-b-4 border-amber-700 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50 text-xs uppercase tracking-widest">Actualizar Clave</button></form></div>
               <div className="bg-red-50 p-6 rounded-3xl border-2 border-red-100"><h4 className="font-black text-red-700 flex items-center gap-2 mb-2"><Trash2 size={20} /> Borrar Alumno</h4><p className="text-[10px] font-bold text-red-400 uppercase mb-3">Esta acción no se puede deshacer.</p><div className="space-y-3"><input type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="Escribe 'ELIMINAR' para confirmar" className="w-full bg-white border-2 border-red-100 rounded-2xl p-3 font-bold text-red-700 focus:border-red-500 outline-none text-xs"/><button disabled={deleteConfirm !== 'ELIMINAR' || actionLoading} onClick={handleDeleteStudent} className="w-full bg-red-500 text-white font-black py-3 rounded-2xl border-b-4 border-red-700 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-30 text-xs uppercase tracking-widest">Eliminar Permanentemente</button></div></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};