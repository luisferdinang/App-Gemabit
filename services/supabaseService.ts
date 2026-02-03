import { supabase } from './supabaseClient';
import { User, TaskLog, Transaction, Quiz, StudentReport, QuizResult, UserRole, ExpenseRequest, SavingsGoal, ExpenseCategory } from '../types';

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

const TASK_NAMES: Record<string, string> = {
  'ATTENDANCE': 'Asistencia',
  'RESPONSIBILITY': 'Responsabilidad',
  'BEHAVIOR': 'Comportamiento',
  'RESPECT': 'Respeto',
  'PARTICIPATION': 'Participación',
  'CHORES': 'Quehaceres',
  'HYGIENE': 'Higiene',
  'READING': 'Lectura'
};

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
    
    // Check for archived users
    if (profile.status === 'DELETED' || profile.status === 'DELETED_ARCHIVE') return { error: 'Esta cuenta ha sido eliminada.' };
    if (profile.status === 'PENDING') return { error: 'Cuenta pendiente de aprobación.' };

    return { user: mapProfileToUser(profile) };
  },

  logout: async () => {
    await supabase.auth.signOut();
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

  // SYSTEM RESET (FACTORY RESET)
  resetSystemData: async (adminUid: string): Promise<{success: boolean, error?: string}> => {
    try {
        // 1. Delete all relational data first
        await supabase.from('transactions').delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
        await supabase.from('tasks').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('quiz_results').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('expense_requests').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('savings_goals').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        
        // 2. Delete teacher created quizzes
        await supabase.from('quizzes').delete().eq('created_by', 'TEACHER');

        // 3. Delete all users EXCEPT the admin
        const { error: profileError } = await supabase.from('profiles').delete().neq('id', adminUid);
        
        if (profileError) return { success: false, error: profileError.message };

        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
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
    // FILTER OUT DELETED
    const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', 'ALUMNO')
        .eq('status', 'APPROVED')
        .neq('status', 'DELETED')
        .neq('status', 'DELETED_ARCHIVE');
    return (data || []).map(mapProfileToUser);
  },

  getPendingUsers: async (): Promise<User[]> => {
    const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('status', 'PENDING')
        .neq('status', 'DELETED')
        .neq('status', 'DELETED_ARCHIVE');
    return (data || []).map(mapProfileToUser);
  },

  getStudentById: async (id: string): Promise<User | undefined> => {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single();
    if (!data || data.status === 'DELETED' || data.status === 'DELETED_ARCHIVE') return undefined;
    return mapProfileToUser(data);
  },

  approveUser: async (uid: string) => {
    await supabase.from('profiles').update({ status: 'APPROVED' }).eq('id', uid);
  },

  rejectUser: async (uid: string) => {
    // Rejection is effectively a delete/archive
    await supabase.from('profiles').update({ status: 'DELETED' }).eq('id', uid);
  },

  deleteStudent: async (uid: string): Promise<{success: boolean, error?: string}> => {
     try {
       const { error: tErr } = await supabase.from('tasks').delete().eq('student_id', uid);
       const { error: trErr } = await supabase.from('transactions').delete().eq('student_id', uid);
       const { error: qErr } = await supabase.from('quiz_results').delete().eq('student_id', uid);
       const { error: eErr } = await supabase.from('expense_requests').delete().eq('student_id', uid);
       const { error: sErr } = await supabase.from('savings_goals').delete().eq('student_id', uid);
       
       const { error: hardError } = await supabase.from('profiles').delete().eq('id', uid);
       
       if (!hardError) return { success: true };

       const { error: softError } = await supabase.from('profiles').update({ status: 'DELETED' }).eq('id', uid);

       if (softError) return { success: false, error: softError.message };
       return { success: true };
     } catch (e: any) {
       return { success: false, error: `EXCEPTION: ${e.message}` };
     }
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
    if (!student || student.status.includes('DELETED')) throw new Error("Código inválido");
    
    const { data: parent } = await supabase.from('profiles').select('linked_student_ids').eq('id', parentUid).single();
    
    if (parent) {
      const currentLinks = parent.linked_student_ids || [];
      if (!currentLinks.includes(student.id)) {
         await supabase.from('profiles').update({ linked_student_ids: [...currentLinks, student.id] }).eq('id', parentUid);
      }
    }
    return mapProfileToUser(student);
  },

  // TASK MANAGEMENT
  getTasks: async (studentId: string, weekId: string = getCurrentWeekId()): Promise<TaskLog[]> => {
    let { data } = await supabase.from('tasks').select('*').eq('student_id', studentId).eq('week_id', weekId);
    
    if (!data || data.length === 0) {
      const { data: student } = await supabase.from('profiles').select('status').eq('id', studentId).single();
      if (!student || student.status.includes('DELETED')) return [];

      const { data: newTasks } = await supabase.from('tasks').insert([
        { student_id: studentId, week_id: weekId, type: 'SCHOOL', status: { 'ATTENDANCE': false, 'RESPONSIBILITY': false, 'BEHAVIOR': false, 'RESPECT': false, 'PARTICIPATION': false } },
        { student_id: studentId, week_id: weekId, type: 'HOME', status: { 'CHORES': false, 'RESPECT': false, 'HYGIENE': false, 'READING': false } }
      ]).select();
      data = newTasks;
    }

    // DEDUPLICATE
    const uniqueTasksMap = new Map<string, any>();
    (data || []).forEach(t => {
       if (!uniqueTasksMap.has(t.type)) {
           uniqueTasksMap.set(t.type, t);
       }
    });

    return Array.from(uniqueTasksMap.values()).map(t => ({ 
        id: t.id, 
        studentId: t.student_id, 
        weekId: t.week_id, 
        type: t.type, 
        status: t.status, 
        updatedAt: new Date(t.updated_at).getTime() 
    }));
  },

  getStudentWeeks: async (studentId: string): Promise<{weekId: string, completion: number}[]> => {
      const { data } = await supabase.from('tasks').select('week_id, status').eq('student_id', studentId);
      
      const weeksMap = new Map<string, number>();
      data?.forEach(task => {
          const total = Object.keys(task.status).length;
          const completed = Object.values(task.status).filter(Boolean).length;
          const percentage = (completed / total) * 100;
          if (weeksMap.has(task.week_id)) {
              const current = weeksMap.get(task.week_id)!;
              weeksMap.set(task.week_id, (current + percentage) / 2);
          } else {
              weeksMap.set(task.week_id, percentage);
          }
      });
      const currentWeek = getCurrentWeekId();
      if (!weeksMap.has(currentWeek)) weeksMap.set(currentWeek, 0);
      return Array.from(weeksMap.entries()).map(([weekId, completion]) => ({ weekId, completion })).sort((a, b) => b.weekId.localeCompare(a.weekId)); 
  },

  updateTaskStatus: async (studentId: string, type: 'SCHOOL' | 'HOME', key: string, value: boolean, weekId: string = getCurrentWeekId()) => {
    const { data: tasks } = await supabase.from('tasks').select('*').eq('student_id', studentId).eq('week_id', weekId).eq('type', type);
    // Take the first one if duplicate exists
    const task = tasks?.[0];
    
    if (task) {
       // IMPORTANT: Check if value is actually changing to prevent double assignment
       if (task.status[key] === value) return false;

       const newStatus = { ...task.status, [key]: value };
       await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id);
       
       // Reward logic: School 20, Home 25
       const reward = type === 'SCHOOL' ? 20 : 25;
       const change = value ? reward : -reward;
       
       // TRANSLATE KEY
       const label = TASK_NAMES[key] || key;

       const { data: student } = await supabase.from('profiles').select('balance').eq('id', studentId).single();
       if (student) {
          await supabase.from('profiles').update({ balance: student.balance + change }).eq('id', studentId);
          await supabase.from('transactions').insert({ 
              student_id: studentId, 
              amount: change, 
              description: value ? `Tarea: ${label}` : `Revocada: ${label}`, 
              type: change > 0 ? 'EARN' : 'SPEND', 
              timestamp: Date.now() 
          });
       }
       return true;
    }
    return false;
  },

  getClassReport: async (): Promise<StudentReport[]> => {
    const weekId = getCurrentWeekId();
    const { data: students } = await supabase.from('profiles').select('*').eq('role', 'ALUMNO').eq('status', 'APPROVED').neq('status', 'DELETED').neq('status', 'DELETED_ARCHIVE');
    const { data: tasks } = await supabase.from('tasks').select('*').eq('week_id', weekId);
    return (students || []).map(s => {
       const studentTasks = tasks?.filter(t => t.student_id === s.id) || [];
       const schoolTask = studentTasks.find(t => t.type === 'SCHOOL');
       const homeTask = studentTasks.find(t => t.type === 'HOME');
       return { student: mapProfileToUser(s), schoolTasksCompleted: schoolTask ? Object.values(schoolTask.status).filter(Boolean).length : 0, schoolTasksTotal: schoolTask ? Object.keys(schoolTask.status).length : 5, homeTasksCompleted: homeTask ? Object.values(homeTask.status).filter(Boolean).length : 0, homeTasksTotal: homeTask ? Object.keys(homeTask.status).length : 4 };
    });
  },

  // TRANSACTION HISTORY
  getTransactions: async (studentId: string): Promise<Transaction[]> => {
      const { data } = await supabase
        .from('transactions')
        .select('*')
        .eq('student_id', studentId)
        .order('timestamp', { ascending: false });
      
      return (data || []).map(t => ({
          id: t.id,
          studentId: t.student_id,
          amount: t.amount,
          description: t.description,
          type: t.type,
          timestamp: t.timestamp
      }));
  },

  // QUIZ MANAGEMENT
  createTeacherQuiz: async (quiz: any): Promise<{success: boolean, error?: string}> => {
    // FIX: Remove 'answer' column insert.
    // The secret word is now stored in 'options[0]' to bypass the missing schema column.
    const { error } = await supabase.from('quizzes').insert({ 
        type: quiz.type, 
        question: quiz.question, 
        options: quiz.options, 
        correct_index: quiz.correctIndex, 
        game_items: quiz.gameItems, 
        target_value: quiz.targetValue, 
        reward: quiz.reward, 
        difficulty: quiz.difficulty, 
        assigned_to: quiz.assigned_to || quiz.assignedTo, 
        created_by: 'TEACHER',
        // answer: quiz.answer // DO NOT UNCOMMENT UNTIL SCHEMA IS UPDATED
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  getAllTeacherQuizzes: async (): Promise<Quiz[]> => {
    const { data, error } = await supabase.from('quizzes').select('*').neq('assigned_to', 'DELETED_ARCHIVE');
    if (error) console.error("Error fetching quizzes:", error);
    return (data || []).reverse().map(q => ({
      id: q.id, type: q.type, question: q.question, options: q.options, correctIndex: q.correct_index,
      gameItems: q.game_items, targetValue: q.target_value, reward: q.reward, difficulty: q.difficulty,
      assignedTo: q.assigned_to, createdBy: q.created_by,
      answer: q.answer
    }));
  },

  deleteQuiz: async (quizId: string): Promise<{success: boolean, error?: string}> => {
    try {
        // HARD DELETE: Remove the row completely
        const { error } = await supabase.from('quizzes').delete().eq('id', quizId);
        if (error) return { success: false, error: error.message };
        return { success: true };
    } catch (err: any) {
        return { success: false, error: err.message };
    }
  },

  getStudentQuizzes: async (studentId: string): Promise<{available: Quiz[], completed: QuizResult[]}> => {
    const { data: results } = await supabase.from('quiz_results').select('*').eq('student_id', studentId);
    const completedIds = (results || []).map(r => r.quiz_id);
    const { data: quizzes } = await supabase.from('quizzes').select('*').neq('assigned_to', 'DELETED_ARCHIVE');
    
    const available = (quizzes || [])
      .filter(q => !completedIds.includes(q.id) && (q.assigned_to === 'ALL' || q.assigned_to === studentId))
      .map(q => ({ 
        id: q.id, type: q.type, question: q.question, options: q.options, correctIndex: q.correct_index,
        gameItems: q.game_items, targetValue: q.target_value, reward: q.reward, difficulty: q.difficulty,
        assignedTo: q.assigned_to, createdBy: q.created_by,
        answer: q.answer 
      }));

    const completed: QuizResult[] = (results || []).map(r => ({
      id: r.id, studentId: r.student_id, quizId: r.quiz_id, questionPreview: r.question_preview,
      score: r.score, earned: r.earned, status: r.status, timestamp: r.created_at
    }));
    return { available, completed };
  },

  getAllQuizResults: async (): Promise<QuizResult[]> => {
    const { data } = await supabase.from('quiz_results').select('*');
    return (data || []).map(r => ({
        id: r.id, studentId: r.student_id, quizId: r.quiz_id, questionPreview: r.question_preview,
        score: r.score, earned: r.earned, status: r.status, timestamp: r.created_at
    }));
  },

  submitQuiz: async (studentId: string, quizId: string, question: string, score: number, earned: number) => {
    // Save as IN_BAG (Completed but not sent to teacher yet)
    await supabase.from('quiz_results').insert({ 
      student_id: studentId, 
      quiz_id: quizId, 
      question_preview: question, 
      score, 
      earned, 
      status: 'IN_BAG', 
      created_at: Date.now() 
    });
  },

  cashOutArcade: async (studentId: string): Promise<{success: boolean, count: number}> => {
     // Move all IN_BAG items to PENDING
     const { data, error } = await supabase
        .from('quiz_results')
        .update({ status: 'PENDING' })
        .eq('student_id', studentId)
        .eq('status', 'IN_BAG')
        .select();
     
     if (error) return { success: false, count: 0 };
     return { success: true, count: data?.length || 0 };
  },

  getPendingQuizApprovals: async () => {
    const { data: results } = await supabase.from('quiz_results').select('*').eq('status', 'PENDING');
    return await Promise.all((results || []).map(async (r) => {
       const { data: student } = await supabase.from('profiles').select('display_name, avatar_url, status').eq('id', r.student_id).single();
       if (!student || student.status.includes('DELETED')) return null;
       return { 
         id: r.id, studentId: r.student_id, quizId: r.quiz_id, questionPreview: r.question_preview, 
         score: r.score, earned: r.earned, status: r.status, timestamp: r.created_at,
         studentName: student?.display_name || 'Unknown', studentAvatar: student?.avatar_url || '' 
       };
    })).then(res => res.filter(r => r !== null));
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
  },

  // --- EXPENSE REQUESTS (GASTOS) ---
  
  requestExpense: async (studentId: string, amount: number, description: string, category: ExpenseCategory): Promise<{success: boolean, error?: string}> => {
      // Validate balance locally first
      const { data: student } = await supabase.from('profiles').select('balance').eq('id', studentId).single();
      if (!student || student.balance < amount) return { success: false, error: 'No tienes suficientes MiniBits.' };

      const { error } = await supabase.from('expense_requests').insert({
          student_id: studentId,
          amount,
          description,
          status: 'PENDING',
          category,
          created_at: Date.now()
      });

      if (error) return { success: false, error: error.message };
      return { success: true };
  },

  getExpenseRequests: async (studentId: string): Promise<ExpenseRequest[]> => {
      const { data } = await supabase
        .from('expense_requests')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false });
      
      return (data || []).map(r => ({
          id: r.id,
          studentId: r.student_id,
          amount: r.amount,
          description: r.description,
          status: r.status,
          category: r.category,
          sentiment: r.sentiment,
          createdAt: r.created_at
      }));
  },

  // NEW: Get all expenses for report
  getAllClassExpenses: async (): Promise<ExpenseRequest[]> => {
    const { data } = await supabase
      .from('expense_requests')
      .select('*, profiles(display_name, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(50); // Limit to last 50 for performance

    return (data || []).map((r: any) => ({
        id: r.id,
        studentId: r.student_id,
        amount: r.amount,
        description: r.description,
        status: r.status,
        category: r.category,
        sentiment: r.sentiment,
        createdAt: r.created_at,
        studentName: r.profiles?.display_name || 'Desconocido',
        studentAvatar: r.profiles?.avatar_url || ''
    }));
  },

  updateExpenseSentiment: async (requestId: string, sentiment: 'HAPPY' | 'NEUTRAL' | 'SAD') => {
      await supabase.from('expense_requests').update({ sentiment }).eq('id', requestId);
  },

  getPendingExpensesForParent: async (studentIds: string[]): Promise<ExpenseRequest[]> => {
      if (!studentIds.length) return [];
      
      const { data } = await supabase
        .from('expense_requests')
        .select('*')
        .in('student_id', studentIds)
        .eq('status', 'PENDING');
      
      return await Promise.all((data || []).map(async (r) => {
          const { data: s } = await supabase.from('profiles').select('display_name, avatar_url').eq('id', r.student_id).single();
          return {
              id: r.id,
              studentId: r.student_id,
              amount: r.amount,
              description: r.description,
              status: r.status,
              category: r.category,
              createdAt: r.created_at,
              studentName: s?.display_name || 'Hijo',
              studentAvatar: s?.avatar_url || ''
          };
      }));
  },

  approveExpense: async (requestId: string) => {
      const { data: req } = await supabase.from('expense_requests').select('*').eq('id', requestId).single();
      if (!req) return;

      const { data: student } = await supabase.from('profiles').select('balance').eq('id', req.student_id).single();
      if (!student) return;

      if (student.balance < req.amount) {
          // Can't approve if balance too low now
          return { success: false, error: 'El saldo del alumno es insuficiente ahora.' };
      }

      // Perform transaction
      await supabase.from('profiles').update({ balance: student.balance - req.amount }).eq('id', req.student_id);
      await supabase.from('transactions').insert({ 
          student_id: req.student_id, 
          amount: -req.amount, 
          description: `Gasto Aprobado: ${req.description}`, 
          type: 'SPEND', 
          timestamp: Date.now() 
      });
      
      await supabase.from('expense_requests').update({ status: 'APPROVED' }).eq('id', requestId);
      return { success: true };
  },

  rejectExpense: async (requestId: string) => {
      await supabase.from('expense_requests').update({ status: 'REJECTED' }).eq('id', requestId);
      return { success: true };
  },

  // --- SAVINGS GOALS (METAS) ---

  createSavingsGoal: async (studentId: string, title: string, targetAmount: number): Promise<{success: boolean, error?: string}> => {
      const { error } = await supabase.from('savings_goals').insert({
          student_id: studentId,
          title,
          target_amount: targetAmount,
          current_amount: 0,
          created_at: Date.now()
      });
      if (error) return { success: false, error: error.message };
      return { success: true };
  },

  updateSavingsGoal: async (goalId: string, title: string, targetAmount: number): Promise<{success: boolean, error?: string}> => {
      const { error } = await supabase.from('savings_goals').update({
          title,
          target_amount: targetAmount
      }).eq('id', goalId);
      if (error) return { success: false, error: error.message };
      return { success: true };
  },

  getSavingsGoals: async (studentId: string): Promise<SavingsGoal[]> => {
      const { data } = await supabase.from('savings_goals').select('*').eq('student_id', studentId);
      return (data || []).map(g => ({
          id: g.id,
          studentId: g.student_id,
          title: g.title,
          targetAmount: g.target_amount,
          currentAmount: g.current_amount,
          icon: g.icon
      }));
  },

  depositToGoal: async (goalId: string, amount: number) => {
      // 1. Get Goal
      const { data: goal } = await supabase.from('savings_goals').select('*').eq('id', goalId).single();
      if (!goal) return { success: false, error: 'Meta no encontrada' };

      // 2. Get Student Balance
      const { data: student } = await supabase.from('profiles').select('balance').eq('id', goal.student_id).single();
      if (!student || student.balance < amount) return { success: false, error: 'Saldo insuficiente' };

      // 3. Transactions (Move money)
      // Decrease Balance
      await supabase.from('profiles').update({ balance: student.balance - amount }).eq('id', goal.student_id);
      // Increase Goal
      await supabase.from('savings_goals').update({ current_amount: goal.current_amount + amount }).eq('id', goalId);
      
      // LOG TRANSACTION (SPEND from Wallet)
      await supabase.from('transactions').insert({ 
          student_id: goal.student_id, 
          amount: -amount, 
          description: `Ahorro: ${goal.title}`, 
          type: 'SPEND', 
          timestamp: Date.now() 
      });

      return { success: true };
  },

  withdrawFromGoal: async (goalId: string, amount: number) => {
      // 1. Get Goal
      const { data: goal } = await supabase.from('savings_goals').select('*').eq('id', goalId).single();
      if (!goal) return { success: false, error: 'Meta no encontrada' };
      if (goal.current_amount < amount) return { success: false, error: 'Fondos insuficientes en la meta' };

      // 2. Get Student
      const { data: student } = await supabase.from('profiles').select('balance').eq('id', goal.student_id).single();
      if (!student) return { success: false, error: 'Error de usuario' };

      // 3. Transactions
      // Increase Balance
      await supabase.from('profiles').update({ balance: student.balance + amount }).eq('id', goal.student_id);
      // Decrease Goal
      await supabase.from('savings_goals').update({ current_amount: goal.current_amount - amount }).eq('id', goalId);

      // LOG TRANSACTION (EARN back to Wallet)
      await supabase.from('transactions').insert({ 
          student_id: goal.student_id, 
          amount: amount, 
          description: `Retiro: ${goal.title}`, 
          type: 'EARN', 
          timestamp: Date.now() 
      });

      return { success: true };
  },

  deleteGoal: async (goalId: string) => {
      // Should probably return funds to balance first, but for simplicity we assume empty or deleted with funds
      // Ideally trigger a withdraw of all funds first.
      const { data: goal } = await supabase.from('savings_goals').select('*').eq('id', goalId).single();
      if (goal && goal.current_amount > 0) {
          await supabaseService.withdrawFromGoal(goalId, goal.current_amount);
      }
      await supabase.from('savings_goals').delete().eq('id', goalId);
      return { success: true };
  },

  // --- SUPER GEMABIT EXCHANGE ---
  exchangeSuperGemabit: async (studentId: string): Promise<{success: boolean, error?: string}> => {
      const { data: student } = await supabase.from('profiles').select('streak_weeks, balance').eq('id', studentId).single();
      
      if (!student) return { success: false, error: 'Estudiante no encontrado' };
      if (student.streak_weeks < 4) return { success: false, error: 'Aún no completas las 4 semanas.' };

      // Exchange: +500 MB (5 GB), -4 Weeks Streak
      const reward = 500;
      await supabase.from('profiles').update({ 
          balance: student.balance + reward,
          streak_weeks: student.streak_weeks - 4
      }).eq('id', studentId);

      await supabase.from('transactions').insert({ 
          student_id: studentId, 
          amount: reward, 
          description: '¡Canje de Super GemaBit! (4 semanas)', 
          type: 'EARN', 
          timestamp: Date.now() 
      });

      return { success: true };
  }
};