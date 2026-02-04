

import { supabase } from './supabaseClient';
import { User, TaskLog, Quiz, QuizResult, ExpenseRequest, SavingsGoal, Transaction, StudentReport, ExpenseCategory, QuizType } from '../types';

export const getCurrentWeekId = () => {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1)/7);
  return `${d.getUTCFullYear()}-W${weekNo}`;
};

export const mapProfileToUser = (profile: any): User => ({
  uid: profile.id,
  role: profile.role,
  displayName: profile.display_name,
  username: profile.username,
  avatar: profile.avatar_url,
  status: profile.status,
  balance: profile.balance || 0,
  xp: profile.xp || 0,
  streakWeeks: profile.streak_weeks || 0,
  linkCode: profile.link_code,
  parentId: profile.parent_id,
  linkedStudentIds: profile.linked_student_ids || []
});

export const supabaseService = {
  subscribeToChanges: (table: string, filter: string | undefined, callback: (payload: any) => void) => {
    const channel = supabase
      .channel(`public:${table}${filter ? ':' + filter : ''}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: table, filter: filter }, callback)
      .subscribe();
    return { unsubscribe: () => supabase.removeChannel(channel) };
  },

  getStudents: async (): Promise<User[]> => {
    const { data } = await supabase.from('profiles').select('*').eq('role', 'ALUMNO').eq('status', 'APPROVED');
    return (data || []).map(mapProfileToUser);
  },

  getStudentById: async (uid: string): Promise<User | null> => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single();
    return data ? mapProfileToUser(data) : null;
  },

  getTasks: async (studentId: string, weekId: string): Promise<TaskLog[]> => {
    const { data } = await supabase.from('tasks').select('*').eq('student_id', studentId).eq('week_id', weekId);
    if (!data) return [];
    return data.map((t: any) => ({
        id: t.id,
        studentId: t.student_id,
        weekId: t.week_id,
        type: t.type,
        status: t.status,
        updatedAt: new Date(t.updated_at).getTime()
    }));
  },

  updateTaskStatus: async (studentId: string, type: string, key: string, value: boolean, weekId: string) => {
    const { data: tasks } = await supabase.from('tasks').select('*').eq('student_id', studentId).eq('week_id', weekId).eq('type', type);
    let task = tasks?.[0];
    
    if (!task) {
        const initialStatus: any = type === 'SCHOOL' 
            ? { 'ATTENDANCE': false, 'RESPONSIBILITY': false, 'BEHAVIOR': false, 'RESPECT': false, 'PARTICIPATION': false }
            : { 'CHORES': false, 'RESPECT': false, 'HYGIENE': false, 'READING': false };
        initialStatus[key] = value;
        const { data: newTask, error } = await supabase.from('tasks').insert({
            student_id: studentId,
            week_id: weekId,
            type,
            status: initialStatus
        }).select().single();
        if (error) return false;
        task = newTask;
    } else {
        const newStatus = { ...task.status, [key]: value };
        const { error } = await supabase.from('tasks').update({ status: newStatus }).eq('id', task.id);
        if (error) return false;
    }

    const reward = type === 'SCHOOL' ? 20 : 25;
    const amount = value ? reward : -reward;
    const { data: student } = await supabase.from('profiles').select('balance').eq('id', studentId).single();
    if (student) {
        await supabase.from('profiles').update({ balance: student.balance + amount }).eq('id', studentId);
        await supabase.from('transactions').insert({
            student_id: studentId,
            amount,
            description: value ? `Misión cumplida: ${key}` : `Misión revocada: ${key}`,
            type: amount > 0 ? 'EARN' : 'SPEND',
            timestamp: Date.now()
        });
    }
    return true;
  },

  login: async (username: string, password?: string) => {
      // For this specific app architecture (migrated from mock), we check the 'profiles' table directly for password
      // In a production app, use supabase.auth.signInWithPassword
      const { data, error } = await supabase.from('profiles').select('*').eq('username', username).single();
      if (error || !data) return { error: 'Usuario no encontrado' };
      if (data.password !== password) return { error: 'Contraseña incorrecta' };
      if (data.status !== 'APPROVED') return { error: 'Cuenta pendiente de aprobación.' };
      
      return { user: mapProfileToUser(data) };
  },

  logout: async () => {
      await supabase.auth.signOut();
  },

  register: async (userData: any, code: string) => {
      const { data: settings } = await supabase.from('app_settings').select('value').eq('key', 'REGISTRATION_CODE').single();
      const validCode = settings?.value || 'lazo123';
      
      if (code !== validCode) return { success: false, error: 'Código de seguridad incorrecto' };
      
      const { data: existing } = await supabase.from('profiles').select('id').eq('username', userData.username).single();
      if (existing) return { success: false, error: 'El usuario ya existe' };
      
      const { error } = await supabase.from('profiles').insert({
          username: userData.username,
          password: userData.password,
          display_name: userData.displayName,
          role: userData.role,
          avatar_url: userData.avatar,
          status: 'PENDING',
          balance: 0,
          xp: 0,
          streak_weeks: 0,
          link_code: userData.role === 'ALUMNO' ? Math.floor(100000 + Math.random() * 900000).toString() : null
      });

      if (error) return { success: false, error: error.message };
      return { success: true };
  },

  getPendingUsers: async () => {
      const { data } = await supabase.from('profiles').select('*').eq('status', 'PENDING');
      return (data || []).map(mapProfileToUser);
  },

  approveUser: async (uid: string) => {
      await supabase.from('profiles').update({ status: 'APPROVED' }).eq('id', uid);
      const weekId = getCurrentWeekId();
      const { data: existing } = await supabase.from('tasks').select('id').eq('student_id', uid).eq('week_id', weekId);
      if (!existing || existing.length === 0) {
          await supabase.from('tasks').insert([
             { student_id: uid, week_id: weekId, type: 'SCHOOL', status: { 'ATTENDANCE': false, 'RESPONSIBILITY': false, 'BEHAVIOR': false, 'RESPECT': false, 'PARTICIPATION': false } },
             { student_id: uid, week_id: weekId, type: 'HOME', status: { 'CHORES': false, 'RESPECT': false, 'HYGIENE': false, 'READING': false } }
          ]);
      }
  },

  rejectUser: async (uid: string) => {
      await supabase.from('profiles').delete().eq('id', uid);
  },

  updateAvatar: async (uid: string, url: string) => {
      const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', uid);
      return !error;
  },

  updateDisplayName: async (uid: string, name: string) => {
      const { error } = await supabase.from('profiles').update({ display_name: name }).eq('id', uid);
      return !error;
  },

  getStudentWeeks: async (studentId: string) => {
      const { data } = await supabase.from('tasks').select('week_id, status').eq('student_id', studentId);
      if (!data) return [];
      
      const weeksMap = new Map();
      data.forEach((t: any) => {
          if (!weeksMap.has(t.week_id)) weeksMap.set(t.week_id, { total: 0, completed: 0 });
          const w = weeksMap.get(t.week_id);
          const keys = Object.keys(t.status);
          w.total += keys.length;
          w.completed += Object.values(t.status).filter(Boolean).length;
      });

      return Array.from(weeksMap.entries()).map(([weekId, stats]: any) => ({
          weekId,
          completion: stats.total > 0 ? (stats.completed / stats.total) * 100 : 0
      }));
  },

  getTransactions: async (studentId: string) => {
      const { data } = await supabase.from('transactions').select('*').eq('student_id', studentId).order('timestamp', { ascending: false });
      return (data || []).map((t: any) => ({ ...t, studentId: t.student_id }));
  },

  getExpenseRequests: async (studentId: string) => {
      const { data } = await supabase.from('expense_requests').select('*').eq('student_id', studentId).order('created_at', { ascending: false });
      return (data || []).map((r: any) => ({
          ...r,
          studentId: r.student_id,
          createdAt: new Date(r.created_at).getTime()
      }));
  },

  requestExpense: async (studentId: string, amount: number, description: string, category: string) => {
      const { error } = await supabase.from('expense_requests').insert({
          student_id: studentId,
          amount,
          description,
          category,
          status: 'PENDING'
      });
      return { success: !error, error: error?.message };
  },

  updateExpenseSentiment: async (id: string, sentiment: string) => {
      await supabase.from('expense_requests').update({ sentiment }).eq('id', id);
  },
  
  approveExpense: async (requestId: string) => {
      const { data: req } = await supabase.from('expense_requests').select('*').eq('id', requestId).single();
      if (!req) return { success: false, error: 'Solicitud no encontrada.' };

      if (req.status !== 'PENDING') {
          return { success: false, error: 'Esta solicitud ya fue procesada anteriormente.' };
      }

      const { data: student } = await supabase.from('profiles').select('balance').eq('id', req.student_id).single();
      if (!student) return { success: false, error: 'Alumno no encontrado.' };

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
  },

  getPendingExpensesForParent: async (studentIds: string[]) => {
      if (studentIds.length === 0) return [];
      const { data } = await supabase.from('expense_requests')
        .select('*, profiles(display_name, avatar_url)')
        .in('student_id', studentIds)
        .eq('status', 'PENDING');
      
      return (data || []).map((r: any) => ({
          ...r,
          studentId: r.student_id,
          studentName: r.profiles?.display_name,
          studentAvatar: r.profiles?.avatar_url,
          createdAt: new Date(r.created_at).getTime()
      }));
  },
  
  getSavingsGoals: async (studentId: string) => {
      const { data } = await supabase.from('savings_goals').select('*').eq('student_id', studentId);
      return (data || []).map((g: any) => ({
          id: g.id,
          studentId: g.student_id,
          title: g.title,
          targetAmount: g.target_amount,
          currentAmount: g.current_amount,
          icon: g.icon
      }));
  },

  createSavingsGoal: async (studentId: string, title: string, targetAmount: number) => {
      const { error } = await supabase.from('savings_goals').insert({
          student_id: studentId,
          title,
          target_amount: targetAmount,
          current_amount: 0,
          icon: 'target'
      });
      return { success: !error, error: error?.message };
  },

  updateSavingsGoal: async (id: string, title: string, targetAmount: number) => {
      const { error } = await supabase.from('savings_goals').update({ title, target_amount: targetAmount }).eq('id', id);
      return { success: !error, error: error?.message };
  },

  deleteGoal: async (id: string) => {
      const { data: goal } = await supabase.from('savings_goals').select('*').eq('id', id).single();
      if (goal && goal.current_amount > 0) {
          const { data: student } = await supabase.from('profiles').select('balance').eq('id', goal.student_id).single();
          if (student) {
              await supabase.from('profiles').update({ balance: student.balance + goal.current_amount }).eq('id', goal.student_id);
              await supabase.from('transactions').insert({
                  student_id: goal.student_id,
                  amount: goal.current_amount,
                  description: `Reembolso Meta: ${goal.title}`,
                  type: 'EARN',
                  timestamp: Date.now()
              });
          }
      }
      await supabase.from('savings_goals').delete().eq('id', id);
  },

  depositToGoal: async (goalId: string, amount: number) => {
      const { data: goal } = await supabase.from('savings_goals').select('*').eq('id', goalId).single();
      if (!goal) return { success: false, error: 'Meta no encontrada' };
      
      const { data: student } = await supabase.from('profiles').select('balance').eq('id', goal.student_id).single();
      if (!student) return { success: false, error: 'Alumno no encontrado' };
      
      if (student.balance < amount) return { success: false, error: 'Saldo insuficiente' };

      await supabase.from('profiles').update({ balance: student.balance - amount }).eq('id', goal.student_id);
      await supabase.from('savings_goals').update({ current_amount: goal.current_amount + amount }).eq('id', goalId);
      await supabase.from('transactions').insert({
          student_id: goal.student_id,
          amount: -amount,
          description: `Ahorro para Meta: ${goal.title}`,
          type: 'SPEND',
          timestamp: Date.now()
      });
      return { success: true };
  },

  withdrawFromGoal: async (goalId: string, amount: number) => {
      const { data: goal } = await supabase.from('savings_goals').select('*').eq('id', goalId).single();
      if (!goal) return { success: false, error: 'Meta no encontrada' };
      if (goal.current_amount < amount) return { success: false, error: 'Monto en meta insuficiente' };

      const { data: student } = await supabase.from('profiles').select('balance').eq('id', goal.student_id).single();
      if (!student) return { success: false, error: 'Alumno no encontrado' };

      await supabase.from('profiles').update({ balance: student.balance + amount }).eq('id', goal.student_id);
      await supabase.from('savings_goals').update({ current_amount: goal.current_amount - amount }).eq('id', goalId);
      await supabase.from('transactions').insert({
          student_id: goal.student_id,
          amount: amount,
          description: `Retiro de Meta: ${goal.title}`,
          type: 'EARN',
          timestamp: Date.now()
      });
      return { success: true };
  },

  getAllTeacherQuizzes: async () => {
      const { data } = await supabase.from('quizzes').select('*');
      return (data || []).map((q: any) => ({
          id: q.id,
          type: q.type,
          question: q.question,
          options: q.options,
          correctIndex: q.correct_index,
          gameItems: q.game_items,
          reward: q.reward,
          difficulty: q.difficulty,
          assignedTo: q.assigned_to,
          createdBy: q.created_by
      }));
  },

  createTeacherQuiz: async (quiz: any) => {
      const { error } = await supabase.from('quizzes').insert({
          type: quiz.type,
          question: quiz.question,
          options: quiz.options,
          correct_index: quiz.correctIndex,
          game_items: quiz.gameItems,
          reward: quiz.reward,
          difficulty: quiz.difficulty,
          assigned_to: quiz.assignedTo,
          created_by: 'TEACHER'
      });
      return { success: !error, error: error?.message };
  },

  deleteQuiz: async (id: string) => {
      const { error } = await supabase.from('quizzes').delete().eq('id', id);
      return { success: !error, error: error?.message };
  },

  getStudentQuizzes: async (studentId: string) => {
      const { data: quizzes } = await supabase.from('quizzes').select('*')
        .or(`assigned_to.eq.ALL,assigned_to.eq.${studentId}`);
        
      const { data: results } = await supabase.from('quiz_results').select('*').eq('student_id', studentId);
      
      const completedIds = (results || []).map((r: any) => r.quiz_id);
      
      const available = (quizzes || [])
        .filter((q: any) => !completedIds.includes(q.id))
        .map((q: any) => ({
          id: q.id,
          type: q.type,
          question: q.question,
          options: q.options,
          correctIndex: q.correct_index,
          gameItems: q.game_items,
          reward: q.reward,
          difficulty: q.difficulty,
          assignedTo: q.assigned_to
        }));
        
      const completed = (results || []).map((r: any) => ({
          id: r.id,
          studentId: r.student_id,
          quizId: r.quiz_id,
          questionPreview: r.question_preview,
          score: r.score,
          earned: r.earned,
          status: r.status,
          timestamp: new Date(r.created_at).getTime()
      }));

      return { available, completed };
  },

  submitQuiz: async (studentId: string, quizId: string, question: string, score: number, earned: number) => {
      await supabase.from('quiz_results').insert({
          student_id: studentId,
          quiz_id: quizId,
          question_preview: question,
          score,
          earned,
          status: 'IN_BAG'
      });
  },

  cashOutArcade: async (studentId: string) => {
      const { data, error } = await supabase.from('quiz_results')
        .update({ status: 'PENDING' })
        .eq('student_id', studentId)
        .eq('status', 'IN_BAG')
        .select();
      return { success: !error, count: data?.length || 0 };
  },

  getAllQuizResults: async () => {
       const { data } = await supabase.from('quiz_results').select('*');
       return (data || []).map((r: any) => ({
          id: r.id,
          studentId: r.student_id,
          quizId: r.quiz_id,
          questionPreview: r.question_preview,
          score: r.score,
          earned: r.earned,
          status: r.status,
          timestamp: new Date(r.created_at).getTime()
      }));
  },

  getPendingQuizApprovals: async () => {
      const { data } = await supabase.from('quiz_results')
        .select('*, profiles(display_name, avatar_url)')
        .eq('status', 'PENDING');
      return (data || []).map((r: any) => ({
          id: r.id,
          studentId: r.student_id,
          quizId: r.quiz_id,
          questionPreview: r.question_preview,
          score: r.score,
          earned: r.earned,
          status: r.status,
          studentName: r.profiles?.display_name,
          studentAvatar: r.profiles?.avatar_url
      }));
  },

  approveQuizRedemption: async (resultId: string) => {
      const { data: result } = await supabase.from('quiz_results').select('*').eq('id', resultId).single();
      if (!result || result.status !== 'PENDING') return;

      const { data: student } = await supabase.from('profiles').select('balance').eq('id', result.student_id).single();
      if (!student) return;
      
      await supabase.from('profiles').update({ balance: student.balance + result.earned }).eq('id', result.student_id);
      await supabase.from('transactions').insert({
          student_id: result.student_id,
          amount: result.earned,
          description: `Arcade: ${result.question_preview}`,
          type: 'EARN',
          timestamp: Date.now()
      });
      await supabase.from('quiz_results').update({ status: 'APPROVED' }).eq('id', resultId);
  },

  rejectQuizRedemption: async (resultId: string) => {
      await supabase.from('quiz_results').update({ status: 'REJECTED' }).eq('id', resultId);
  },

  getClassReport: async () => {
      const { data: students } = await supabase.from('profiles').select('*').eq('role', 'ALUMNO').eq('status', 'APPROVED');
      const weekId = getCurrentWeekId();
      
      const reports = await Promise.all((students || []).map(async (s: any) => {
          const { data: tasks } = await supabase.from('tasks').select('*').eq('student_id', s.id).eq('week_id', weekId);
          let schoolTasksTotal = 5;
          let schoolTasksCompleted = 0;
          let homeTasksTotal = 4;
          let homeTasksCompleted = 0;

          const schoolTask = tasks?.find((t: any) => t.type === 'SCHOOL');
          if (schoolTask) {
              schoolTasksTotal = Object.keys(schoolTask.status).length;
              schoolTasksCompleted = Object.values(schoolTask.status).filter(Boolean).length;
          }

          const homeTask = tasks?.find((t: any) => t.type === 'HOME');
          if (homeTask) {
              homeTasksTotal = Object.keys(homeTask.status).length;
              homeTasksCompleted = Object.values(homeTask.status).filter(Boolean).length;
          }

          return {
              student: mapProfileToUser(s),
              schoolTasksCompleted,
              schoolTasksTotal,
              homeTasksCompleted,
              homeTasksTotal
          };
      }));
      return reports;
  },

  getAllClassExpenses: async () => {
      const { data } = await supabase.from('expense_requests')
        .select('*, profiles(display_name, avatar_url)')
        .order('created_at', { ascending: false });
        
      return (data || []).map((r: any) => ({
          id: r.id,
          studentId: r.student_id,
          amount: r.amount,
          description: r.description,
          status: r.status,
          category: r.category,
          studentName: r.profiles?.display_name,
          studentAvatar: r.profiles?.avatar_url,
          createdAt: new Date(r.created_at).getTime()
      }));
  },

  getRegistrationCode: async () => {
      const { data } = await supabase.from('app_settings').select('value').eq('key', 'REGISTRATION_CODE').single();
      return data?.value || 'lazo123';
  },

  updateRegistrationCode: async (code: string) => {
      const { error } = await supabase.from('app_settings').update({ value: code }).eq('key', 'REGISTRATION_CODE');
      return !error;
  },

  adminResetStudentPassword: async (uid: string, newPass: string) => {
      const { error } = await supabase.from('profiles').update({ password: newPass }).eq('id', uid);
      return { success: !error, error: error?.message };
  },

  deleteStudent: async (uid: string) => {
      const { error } = await supabase.from('profiles').delete().eq('id', uid);
      return { success: !error, error: error?.message };
  },

  updatePassword: async (uid: string, newPass: string) => {
      const { error } = await supabase.from('profiles').update({ password: newPass }).eq('id', uid);
      return { success: !error, error: error?.message };
  },

  resetSystemData: async (teacherUid: string) => {
      const { error: e1 } = await supabase.from('profiles').delete().neq('id', teacherUid);
      if (e1) return { success: false, error: e1.message };
      
      const { error: e2 } = await supabase.from('tasks').delete().neq('id', 0);
      if (e2) return { success: false, error: e2.message };

      const { error: e3 } = await supabase.from('transactions').delete().neq('id', 0);
      if (e3) return { success: false, error: e3.message };

      const { error: e4 } = await supabase.from('quiz_results').delete().neq('id', 0);
      if (e4) return { success: false, error: e4.message };

      const { error: e5 } = await supabase.from('expense_requests').delete().neq('id', 0);
      if (e5) return { success: false, error: e5.message };

      const { error: e6 } = await supabase.from('savings_goals').delete().neq('id', 0);
      if (e6) return { success: false, error: e6.message };

      return { success: true };
  },

  linkParent: async (parentUid: string, linkCode: string) => {
      const { data: student } = await supabase.from('profiles').select('*').eq('link_code', linkCode).single();
      if (!student) throw new Error("Código inválido");

      const { data: parent } = await supabase.from('profiles').select('linked_student_ids').eq('id', parentUid).single();
      if (!parent) throw new Error("Padre no encontrado");
      const currentLinks = parent.linked_student_ids || [];
      
      if (!currentLinks.includes(student.id)) {
          await supabase.from('profiles').update({ linked_student_ids: [...currentLinks, student.id] }).eq('id', parentUid);
      }
      return student;
  },

  exchangeSuperGemabit: async (studentId: string) => {
      const { data: student } = await supabase.from('profiles').select('*').eq('id', studentId).single();
      if (student.streak_weeks < 4) return { success: false, error: 'Racha insuficiente' };

      await supabase.from('profiles').update({ 
          balance: student.balance + 500,
          streak_weeks: student.streak_weeks - 4
      }).eq('id', studentId);

      await supabase.from('transactions').insert({
          student_id: studentId,
          amount: 500,
          description: 'Canje Super GemaBit',
          type: 'EARN',
          timestamp: Date.now()
      });
      return { success: true };
  }
};
