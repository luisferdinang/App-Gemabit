
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
export const mapProfileToUser = (profile: any): User => ({
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

const API_KEY_EXCHANGE = 'ec9a75dc8e61f17ae092f519';

export const supabaseService = {

  // REALTIME SUBSCRIPTION HELPER
  subscribeToChanges: (table: string, filter: string | undefined, callback: (payload?: any) => void) => {
    const channel = supabase
      .channel(`public:${table}${filter ? ':' + filter : ''}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: table, filter: filter },
        (payload) => {
          console.log(`Realtime change in ${table}:`, payload);
          callback(payload);
        }
      )
      .subscribe();

    return {
      unsubscribe: () => {
        supabase.removeChannel(channel);
      }
    };
  },

  // CURRENCY EXCHANGE LOGIC (Optimized)
  getDailyExchangeRate: async (): Promise<number> => {
    try {
      const today = new Date().toISOString().split('T')[0]; // Formato YYYY-MM-DD

      // 1. Consultar BD Local
      const { data: localData } = await supabase
        .from('exchange_rates')
        .select('rate')
        .eq('date', today)
        .single();

      if (localData) {
        console.log("💱 Tasa obtenida de Base de Datos (Sin gasto de API)");
        return localData.rate;
      }

      // 2. Si no existe, Consultar API Externa
      console.log("🌐 Consultando API Externa de Divisas...");
      const response = await fetch(`https://v6.exchangerate-api.com/v6/${API_KEY_EXCHANGE}/latest/USD`);
      const json = await response.json();

      if (json.result === 'success') {
        const rate = json.conversion_rates.VES;

        // 3. Guardar en BD para futuras consultas hoy
        await supabase.from('exchange_rates').insert({
          date: today,
          rate: rate
        });

        return rate;
      }

      return 0; // Fallback
    } catch (e) {
      console.error("Error fetching exchange rate:", e);
      return 0;
    }
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

  // SYSTEM START DATE MANAGEMENT
  getSystemStartWeekId: async (): Promise<string | null> => {
    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'system_start_week_id')
        .single();

      if (error || !data) return null;
      return data.value;
    } catch (e) {
      return null;
    }
  },

  updateSystemStartWeekId: async (weekId: string): Promise<boolean> => {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'system_start_week_id', value: weekId });

    return !error;
  },

  // AUTHENTICATION
  login: async (username: string, password?: string): Promise<{ user?: User, error?: string }> => {
    const cleanUsername = username.toLowerCase().replace(/\s+/g, '');
    const email = `${cleanUsername}@gemabit.app`;

    // Check if user exists first to provide better console diagnostics
    const { data: userExists } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username)
      .single();

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password: password || 'nopassword',
    });

    if (authError) {
      if (authError.message.includes('Invalid login')) {
        if (!userExists) {
          console.error(`🔴 ERROR LOGIN: El usuario "${username}" NO existe en la base de datos.`);
        } else {
          console.error(`🟠 ERROR LOGIN: El usuario "${username}" existe, pero la CONTRASEÑA es incorrectA.`);
        }
        return { error: 'Usuario o contraseña incorrectos.' };
      }
      console.error("❌ ERROR LOGIN INESPERADO:", authError.message);
      return { error: 'Error al iniciar sesión.' };
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (!profile) return { error: 'Perfil no encontrado' };

    if (profile.status === 'DELETED' || profile.status === 'DELETED_ARCHIVE') return { error: 'Esta cuenta ha sido eliminada.' };
    if (profile.status === 'PENDING') return { error: 'Cuenta pendiente de aprobación.' };

    return { user: mapProfileToUser(profile) };
  },

  logout: async () => {
    await supabase.auth.signOut();
  },

  updatePassword: async (newPassword: string): Promise<{ success: boolean, error?: string }> => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  adminResetStudentPassword: async (studentId: string, newPassword: string): Promise<{ success: boolean, error?: string }> => {
    const { data, error } = await supabase.rpc('reset_user_password', {
      user_id: studentId,
      new_password: newPassword
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  },

  changeLinkedUserPassword: async (
    currentUserId: string,
    targetUserId: string,
    newPassword: string,
    currentUserRole: 'ALUMNO' | 'PADRE'
  ): Promise<{ success: boolean, error?: string }> => {
    try {
      // Validar que los usuarios estén vinculados
      const { data: currentUser } = await supabase
        .from('profiles')
        .select('link_code')
        .eq('id', currentUserId)
        .single();

      const { data: targetUser } = await supabase
        .from('profiles')
        .select('link_code, role')
        .eq('id', targetUserId)
        .single();

      if (!currentUser || !targetUser) {
        return { success: false, error: 'Usuario no encontrado' };
      }

      // Validar la relación según el rol
      let isLinked = false;

      if (currentUserRole === 'ALUMNO') {
        // El alumno solo puede cambiar contraseñas de padres vinculados a él
        if (targetUser.role !== 'PADRE') {
          return { success: false, error: 'Solo puedes cambiar contraseñas de tus padres' };
        }
        // Verificar que el padre esté vinculado al alumno
        const { data: parentLink } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', targetUserId)
          .eq('link_code', currentUser.link_code)
          .single();

        isLinked = !!parentLink;
      } else if (currentUserRole === 'PADRE') {
        // El padre solo puede cambiar contraseñas de hijos vinculados a él
        if (targetUser.role !== 'ALUMNO') {
          return { success: false, error: 'Solo puedes cambiar contraseñas de tus hijos' };
        }
        // Verificar que el hijo esté vinculado al padre
        const { data: childLink } = await supabase
          .from('profiles')
          .select('id')
          .eq('id', targetUserId)
          .eq('link_code', currentUser.link_code)
          .single();

        isLinked = !!childLink;
      }

      if (!isLinked) {
        return { success: false, error: 'No tienes permiso para cambiar esta contraseña' };
      }

      // Cambiar la contraseña usando la función RPC
      const { error } = await supabase.rpc('reset_user_password', {
        user_id: targetUserId,
        new_password: newPassword
      });

      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  restartProject: async (): Promise<{ success: boolean, error?: string }> => {
    try {
      const zeroUuid = '00000000-0000-0000-0000-000000000000';

      // 1. Clear all history/progress tables
      await supabase.from('transactions').delete().neq('id', zeroUuid);
      await supabase.from('tasks').delete().neq('id', zeroUuid);
      await supabase.from('quiz_results').delete().neq('id', zeroUuid);
      await supabase.from('expense_requests').delete().neq('id', zeroUuid);
      await supabase.from('savings_goals').delete().neq('id', zeroUuid);

      // 2. Reset student/parent balances and streaks (Except Teacher)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          balance: 0,
          xp: 0,
          streak_weeks: 0
        })
        .neq('role', 'MAESTRA');

      if (profileError) return { success: false, error: profileError.message };

      // 3. Set the current week as the new "Week 1"
      await supabaseService.updateSystemStartWeekId(getCurrentWeekId());

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  resetSystemData: async (adminUid: string): Promise<{ success: boolean, error?: string }> => {
    try {
      const zeroUuid = '00000000-0000-0000-0000-000000000000';

      await supabase.from('transactions').delete().neq('id', zeroUuid);
      await supabase.from('tasks').delete().neq('id', zeroUuid);
      await supabase.from('quiz_results').delete().neq('id', zeroUuid);
      await supabase.from('expense_requests').delete().neq('id', zeroUuid);
      await supabase.from('savings_goals').delete().neq('id', zeroUuid);

      await supabase.from('quizzes').delete().eq('created_by', 'TEACHER');

      const { error: profileError } = await supabase
        .from('profiles')
        .delete()
        .neq('id', adminUid)
        .neq('role', 'MAESTRA');

      if (profileError) return { success: false, error: profileError.message };

      // Set the current week as the new "Week 1"
      await supabaseService.updateSystemStartWeekId(getCurrentWeekId());

      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  },

  register: async (userData: Partial<User>, specialCode: string): Promise<{ success: boolean, error?: string }> => {
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

    const isStudent = userData.role === 'ALUMNO';
    const defaultAvatar = isStudent
      ? `https://api.dicebear.com/9.x/bottts/svg?seed=${userData.username}`
      : `https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Animated-Fluent-Emojis@master/Emojis/Activities/Soccer%20ball.png`;

    const { error: dbError } = await supabase.from('profiles').insert({
      id: authData.user.id,
      role: userData.role,
      display_name: userData.displayName,
      username: userData.username,
      avatar_url: userData.avatar || defaultAvatar,
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

  getStudents: async (): Promise<User[]> => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'ALUMNO')
      .eq('status', 'APPROVED')
      .neq('status', 'DELETED')
      .neq('status', 'DELETED_ARCHIVE');
    return (data || []).map(mapProfileToUser);
  },

  getLinkedParents: async (studentId: string): Promise<User[]> => {
    // Get student's link_code
    const { data: student } = await supabase
      .from('profiles')
      .select('link_code')
      .eq('id', studentId)
      .single();

    if (!student || !student.link_code) return [];

    // Get parents with the same link_code
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'PADRE')
      .eq('link_code', student.link_code);

    return (data || []).map(mapProfileToUser);
  },

  getParents: async (): Promise<User[]> => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'PADRE')
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
    await supabase.from('profiles').update({ status: 'DELETED' }).eq('id', uid);
  },

  deleteStudent: async (uid: string): Promise<{ success: boolean, error?: string }> => {
    try {
      await supabase.from('tasks').delete().eq('student_id', uid);
      await supabase.from('transactions').delete().eq('student_id', uid);
      await supabase.from('quiz_results').delete().eq('student_id', uid);
      await supabase.from('expense_requests').delete().eq('student_id', uid);
      await supabase.from('savings_goals').delete().eq('student_id', uid);

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

  getStudentWeeks: async (studentId: string): Promise<{ weekId: string, completion: number }[]> => {
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
    const task = tasks?.[0];

    if (task) {
      if (task.status[key] === value) return false;

      const newStatus = { ...task.status, [key]: value };
      await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id);

      const reward = type === 'SCHOOL' ? 20 : 25;
      const change = value ? reward : -reward;

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

  createTeacherQuiz: async (quiz: any): Promise<{ success: boolean, error?: string }> => {
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
      created_by: 'TEACHER'
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

  deleteQuiz: async (quizId: string): Promise<{ success: boolean, error?: string }> => {
    try {
      const { error } = await supabase.from('quizzes').delete().eq('id', quizId);
      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  getStudentQuizzes: async (studentId: string): Promise<{ available: Quiz[], completed: QuizResult[] }> => {
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

  cashOutArcade: async (studentId: string): Promise<{ success: boolean, count: number }> => {
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
    if (!result || result.status !== 'PENDING') return;
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

  requestExpense: async (studentId: string, amount: number, description: string, category: ExpenseCategory): Promise<{ success: boolean, error?: string }> => {
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

  getAllClassExpenses: async (): Promise<ExpenseRequest[]> => {
    const { data } = await supabase
      .from('expense_requests')
      .select('*, profiles(display_name, avatar_url)')
      .order('created_at', { ascending: false })
      .limit(50);

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

  approveExpense: async (requestId: string): Promise<{ success: boolean, error?: string }> => {
    // 1. Fetch request with strict status check and lock
    const { data: req, error: fetchErr } = await supabase.from('expense_requests').select('*').eq('id', requestId).single();

    if (fetchErr || !req) return { success: false, error: 'Solicitud no encontrada' };
    if (req.status !== 'PENDING') return { success: false, error: 'Esta solicitud ya fue aprobada o rechazada' };

    // 2. Double check student balance
    const { data: student, error: studentErr } = await supabase.from('profiles').select('balance').eq('id', req.student_id).single();
    if (studentErr || !student) return { success: false, error: 'Alumno no encontrado' };

    if (student.balance < req.amount) {
      return { success: false, error: 'El saldo del alumno es insuficiente ahora' };
    }

    // 3. Atomically perform updates
    // Note: Ideally these should be in a Postgres function (RPC) to guarantee atomicity.

    // Update Status first to "lock" the request
    const { error: statusErr } = await supabase.from('expense_requests').update({ status: 'APPROVED' }).eq('id', requestId);
    if (statusErr) return { success: false, error: 'Error al actualizar estado' };

    // Update Balance
    const { error: balErr } = await supabase.from('profiles').update({ balance: student.balance - req.amount }).eq('id', req.student_id);
    if (balErr) {
      // Revert status if balance fails
      await supabase.from('expense_requests').update({ status: 'PENDING' }).eq('id', requestId);
      return { success: false, error: 'No se pudo actualizar el saldo' };
    }

    // Log Transaction
    await supabase.from('transactions').insert({
      student_id: req.student_id,
      amount: -req.amount,
      description: `Gasto Aprobado: ${req.description}`,
      type: 'SPEND',
      timestamp: Date.now()
    });

    return { success: true };
  },

  rejectExpense: async (requestId: string) => {
    await supabase.from('expense_requests').update({ status: 'REJECTED' }).eq('id', requestId);
    return { success: true };
  },

  createSavingsGoal: async (studentId: string, title: string, targetAmount: number): Promise<{ success: boolean, error?: string }> => {
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

  updateSavingsGoal: async (goalId: string, title: string, targetAmount: number): Promise<{ success: boolean, error?: string }> => {
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

  deleteGoal: async (goalId: string) => {
    await supabase.from('savings_goals').delete().eq('id', goalId);
    return { success: true };
  },

  exchangeSuperGemabit: async (studentId: string): Promise<{ success: boolean, error?: string }> => {
    const { data: student } = await supabase.from('profiles').select('streak_weeks, balance').eq('id', studentId).single();

    if (!student) return { success: false, error: 'Estudiante no encontrado' };
    if (student.streak_weeks < 4) return { success: false, error: 'Aún no completas las 4 semanas.' };

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
