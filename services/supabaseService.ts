import { supabase } from './supabaseClient';
import { User, TaskLog, Transaction, Quiz, StudentReport, QuizResult, UserRole } from '../types';

// Helper to generate Week ID
export const getCurrentWeekId = () => {
  const now = new Date();
  const onejan = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil((((now.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${week}`;
};

// Helper to map DB profile to User Type
const mapProfileToUser = (profile: any): User => ({
  uid: profile.id,
  role: profile.role,
  displayName: profile.display_name,
  username: profile.username,
  avatar: profile.avatar_url,
  status: profile.status,
  balance: profile.balance,
  xp: profile.xp,
  streakWeeks: profile.streak_weeks,
  linkCode: profile.link_code,
  linkedStudentIds: profile.linked_student_ids || [],
});

export const supabaseService = {
  
  // REALTIME SUBSCRIPTION HELPER
  subscribeToChanges: (table: string, filter: string | undefined, callback: () => void) => {
    const channel = supabase
      .channel(`public:${table}${filter ? ':' + filter : ''}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: table, filter: filter },
        (payload) => {
          console.log('Realtime change received:', payload);
          callback();
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      }
    };
  },

  // REGISTRATION CODE MANAGEMENT
  getRegistrationCode: async (): Promise<string> => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'registration_code')
        .single();
      
      if (error || !data) return 'lazo123';
      return data.value;
    } catch (e) {
      return 'lazo123';
    }
  },

  updateRegistrationCode: async (newCode: string): Promise<boolean> => {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'registration_code', value: newCode });
    
    return !error;
  },

  // AUTHENTICATION
  login: async (username: string, password?: string): Promise<{user?: User, error?: string}> => {
    const email = `${username.toLowerCase().replace(/\s+/g, '')}@gemabit.app`;
    
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: password || 'nopassword',
    });

    if (authError) {
       if (authError.message.includes('Invalid login')) return { error: 'Usuario o contraseña incorrectos.' };
       return { error: 'Error al iniciar sesión.' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (!profile) return { error: 'Perfil no encontrado' };
    if (profile.status === 'PENDING') return { error: 'Cuenta pendiente de aprobación.' };

    return { user: mapProfileToUser(profile) };
  },

  updatePassword: async (newPassword: string): Promise<{success: boolean, error?: string}> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  // ADMIN ACTION: Reset Student Password
  adminResetStudentPassword: async (studentId: string, newPassword: string): Promise<{success: boolean, error?: string}> => {
    const { data, error } = await supabase.rpc('reset_user_password', {
      user_id: studentId,
      new_password: newPassword
    });
    
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  register: async (userData: Partial<User>, specialCode: string): Promise<{success: boolean, error?: string}> => {
    if (userData.role === 'MAESTRA') {
        return { success: false, error: 'Acceso denegado. El registro de nuevas maestras está bloqueado.' };
    }

    const validCode = await supabaseService.getRegistrationCode();
    if (specialCode !== validCode) return { success: false, error: 'El Código Especial es incorrecto. Pídeselo a tu Maestra.' };
    
    const email = `${userData.username?.toLowerCase().replace(/\s+/g, '')}@gemabit.app`;
    
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password: userData.password || '123456',
    });

    if (authError) return { success: false, error: authError.message };
    if (!authData.user) return { success: false, error: 'Error creando usuario' };

    const linkCode = userData.role === 'ALUMNO' ? Math.floor(100000 + Math.random() * 900000).toString() : null;

    const { error: dbError } = await supabase.from('profiles').insert({
      id: authData.user.id,
      role: userData.role,
      display_name: userData.displayName,
      username: userData.username,
      avatar_url: userData.avatar,
      status: 'PENDING',
      balance: 0,
      xp: 0,
      streak_weeks: 0,
      link_code: linkCode
    });

    if (dbError) return { success: false, error: dbError.message };

    if (userData.role === 'ALUMNO') {
      const weekId = getCurrentWeekId();
      await supabase.from('tasks').insert([
        { student_id: authData.user.id, week_id: weekId, type: 'SCHOOL', status: { 'ATTENDANCE': false, 'RESPONSIBILITY': false, 'BEHAVIOR': false, 'RESPECT': false, 'PARTICIPATION': false } },
        { student_id: authData.user.id, week_id: weekId, type: 'HOME', status: { 'CHORES': false, 'RESPECT': false, 'HYGIENE': false, 'READING': false } }
      ]);
    }

    return { success: true };
  },

  // USER MANAGEMENT
  getStudents: async (): Promise<User[]> => {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'ALUMNO').eq('status', 'APPROVED');
    return (data || []).map(mapProfileToUser);
  },

  getPendingUsers: async (): Promise<User[]> => {
    const { data } = await supabase.from('profiles').select('*').eq('status', 'PENDING');
    return (data || []).map(mapProfileToUser);
  },

  getStudentById: async (id: string): Promise<User | undefined> => {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
    return data ? mapProfileToUser(data) : undefined;
  },

  approveUser: async (uid: string) => {
    await supabase.from('profiles').update({ status: 'APPROVED' }).eq('id', uid);
  },

  rejectUser: async (uid: string) => {
    await supabase.from('profiles').delete().eq('id', uid);
  },

  deleteStudent: async (uid: string): Promise<boolean> => {
     const { error } = await supabase.from('profiles').delete().eq('id', uid);
     return !error;
  },

  updateAvatar: async (uid: string, newAvatarUrl: string) => {
    const { error } = await supabase.from('profiles').update({ avatar_url: newAvatarUrl }).eq('id', uid);
    return !error;
  },

  updateDisplayName: async (uid: string, newName: string) => {
    const { error } = await supabase.from('profiles').update({ display_name: newName }).eq('id', uid);
    return !error;
  },

  linkParent: async (parentUid: string, linkCode: string) => {
    const { data: student } = await supabase.from('profiles').select('*').eq('link_code', linkCode).single();
    if (!student) throw new Error("Código inválido");
    const { data: parent } = await supabase.from('profiles').select('linked_student_ids').eq('id', parentUid).single();
    const currentLinks = parent.linked_student_ids || [];
    if (!currentLinks.includes(student.id)) {
       await supabase.from('profiles').update({ linked_student_ids: [...currentLinks, student.id] }).eq('id', parentUid);
    }
    return mapProfileToUser(student);
  },

  // TASK MANAGEMENT
  getTasks: async (studentId: string, weekId: string = getCurrentWeekId()): Promise<TaskLog[]> => {
    let { data } = await supabase.from('tasks').select('*').eq('student_id', studentId).eq('week_id', weekId);
    if (!data || data.length === 0) {
      const { data: newTasks } = await supabase.from('tasks').insert([
        { student_id: studentId, week_id: weekId, type: 'SCHOOL', status: { 'ATTENDANCE': false, 'RESPONSIBILITY': false, 'BEHAVIOR': false, 'RESPECT': false, 'PARTICIPATION': false } },
        { student_id: studentId, week_id: weekId, type: 'HOME', status: { 'CHORES': false, 'RESPECT': false, 'HYGIENE': false, 'READING': false } }
      ]).select();
      data = newTasks;
    }
    return (data || []).map(t => ({ id: t.id, studentId: t.student_id, weekId: t.week_id, type: t.type, status: t.status, updatedAt: new Date(t.updated_at).getTime() }));
  },

  // Get all available weeks for a student (for Teacher History)
  getStudentWeeks: async (studentId: string): Promise<{weekId: string, completion: number}[]> => {
      const { data } = await supabase.from('tasks').select('week_id, status').eq('student_id', studentId);
      
      const weeksMap = new Map<string, number>();
      
      data?.forEach(task => {
          const total = Object.keys(task.status).length;
          const completed = Object.values(task.status).filter(Boolean).length;
          const percentage = (completed / total) * 100;
          
          if (weeksMap.has(task.week_id)) {
              // Average between School and Home if both exist
              const current = weeksMap.get(task.week_id)!;
              weeksMap.set(task.week_id, (current + percentage) / 2);
          } else {
              weeksMap.set(task.week_id, percentage);
          }
      });

      // Ensure current week exists in list even if empty
      const currentWeek = getCurrentWeekId();
      if (!weeksMap.has(currentWeek)) {
          weeksMap.set(currentWeek, 0);
      }

      return Array.from(weeksMap.entries())
        .map(([weekId, completion]) => ({ weekId, completion }))
        .sort((a, b) => b.weekId.localeCompare(a.weekId)); // Sort newest first
  },

  updateTaskStatus: async (studentId: string, type: 'SCHOOL' | 'HOME', key: string, value: boolean, weekId: string = getCurrentWeekId()) => {
    const { data: tasks } = await supabase.from('tasks').select('*').eq('student_id', studentId).eq('week_id', weekId).eq('type', type);
    const task = tasks?.[0];
    if (task) {
       const newStatus = { ...task.status, [key]: value };
       await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id);
       const reward = type === 'SCHOOL' ? 20 : 25;
       const change = value ? reward : -reward;
       const { data: student } = await supabase.from('profiles').select('balance').eq('id', studentId).single();
       if (student) {
          await supabase.from('profiles').update({ balance: student.balance + change }).eq('id', studentId);
          await supabase.from('transactions').insert({ student_id: studentId, amount: change, description: value ? `Tarea: ${key}` : `Revocada: ${key}`, type: change > 0 ? 'EARN' : 'SPEND', timestamp: Date.now() });
       }
       return true;
    }
    return false;
  },

  getClassReport: async (): Promise<StudentReport[]> => {
    const weekId = getCurrentWeekId();
    const { data: students } = await supabase.from('profiles').select('*').eq('role', 'ALUMNO').eq('status', 'APPROVED');
    const { data: tasks } = await supabase.from('tasks').select('*').eq('week_id', weekId);
    return (students || []).map(s => {
       const studentTasks = tasks?.filter(t => t.student_id === s.id) || [];
       const schoolTask = studentTasks.find(t => t.type === 'SCHOOL');
       const homeTask = studentTasks.find(t => t.type === 'HOME');
       return { student: mapProfileToUser(s), schoolTasksCompleted: schoolTask ? Object.values(schoolTask.status).filter(Boolean).length : 0, schoolTasksTotal: schoolTask ? Object.keys(schoolTask.status).length : 5, homeTasksCompleted: homeTask ? Object.values(homeTask.status).filter(Boolean).length : 0, homeTasksTotal: homeTask ? Object.keys(homeTask.status).length : 4 };
    });
  },

  // QUIZ MANAGEMENT
  
  createTeacherQuiz: async (quiz: any) => {
    await supabase.from('quizzes').insert({ type: quiz.type, question: quiz.question, options: quiz.options, correct_index: quiz.correctIndex, game_items: quiz.gameItems, target_value: quiz.targetValue, reward: quiz.reward, difficulty: quiz.difficulty, assigned_to: quiz.assignedTo, created_by: 'TEACHER' });
  },

  // Fetch ALL quizzes created by teachers (for Teacher Dashboard)
  getAllTeacherQuizzes: async (): Promise<Quiz[]> => {
    const { data } = await supabase.from('quizzes').select('*').eq('created_by', 'TEACHER').order('created_at', { ascending: false });
    return (data || []).map(q => ({
      id: q.id,
      type: q.type,
      question: q.question,
      options: q.options,
      correctIndex: q.correct_index,
      gameItems: q.game_items,
      targetValue: q.target_value,
      reward: q.reward,
      difficulty: q.difficulty,
      assignedTo: q.assigned_to,
      createdBy: q.created_by
    }));
  },

  // Delete a quiz
  deleteQuiz: async (quizId: string): Promise<boolean> => {
    const { error } = await supabase.from('quizzes').delete().eq('id', quizId);
    return !error;
  },

  getStudentQuizzes: async (studentId: string): Promise<{available: Quiz[], completed: QuizResult[]}> => {
    const { data: results } = await supabase.from('quiz_results').select('*').eq('student_id', studentId);
    const completedIds = (results || []).map(r => r.quiz_id);
    const { data: quizzes } = await supabase.from('quizzes').select('*');
    const available = (quizzes || []).filter(q => !completedIds.includes(q.id) && (q.assigned_to === 'ALL' || q.assigned_to === studentId)).map(q => ({ id: q.id, type: q.type, question: q.question, options: q.options, correctIndex: q.correct_index, gameItems: q.game_items, targetValue: q.target_value, reward: q.reward, difficulty: q.difficulty, assigned_to: q.assigned_to, createdBy: q.created_by }));
    return { available, completed: (results || []).map(r => ({ id: r.id, studentId: r.student_id, quizId: r.quiz_id, questionPreview: r.question_preview, score: r.score, earned: r.earned, status: r.status, timestamp: r.created_at })) };
  },

  // Get Arcade results specifically for a student (Teacher View)
  getStudentArcadeResults: async (studentId: string): Promise<QuizResult[]> => {
    const { data } = await supabase.from('quiz_results').select('*').eq('student_id', studentId).order('created_at', { ascending: false });
    return (data || []).map(r => ({
        id: r.id,
        studentId: r.student_id,
        quizId: r.quiz_id,
        questionPreview: r.question_preview,
        score: r.score,
        earned: r.earned,
        status: r.status,
        timestamp: r.created_at
    }));
  },

  submitQuiz: async (studentId: string, quizId: string, question: string, score: number, earned: number) => {
    await supabase.from('quiz_results').insert({ student_id: studentId, quiz_id: quizId, question_preview: question, score, earned, status: 'PENDING', created_at: Date.now() });
  },

  getPendingQuizApprovals: async () => {
    const { data: results } = await supabase.from('quiz_results').select('*').eq('status', 'PENDING');
    return await Promise.all((results || []).map(async (r) => {
       const { data: student } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', r.student_id).single();
       return { ...r, timestamp: r.created_at, studentName: student?.display_name || 'Unknown', studentAvatar: student?.avatar_url || '' };
    }));
  },

  approveQuizRedemption: async (resultId: string) => {
     const { data: result } = await supabase.from('quiz_results').select('*').eq('id', resultId).single();
     if (!result) return;
     await supabase.from('quiz_results').update({ status: 'APPROVED' }).eq('id', resultId);
     const { data: student } = await supabase.from('profiles').select('balance').eq('id', result.student_id).single();
     if (student) {
        await supabase.from('profiles').update({ balance: student.balance + result.earned }).eq('id', result.student_id);
        await supabase.from('transactions').insert({ student_id: result.student_id, amount: result.earned, description: 'Recompensa de Quiz (Aprobado)', type: 'EARN', timestamp: Date.now() });
     }
  },

  rejectQuizRedemption: async (resultId: string) => {
    await supabase.from('quiz_results').update({ status: 'REJECTED' }).eq('id', resultId);
  }
};