import { User, TaskLog, Transaction, UserStatus, Quiz, StudentReport, QuizResult } from '../types';

// DiceBear API for robust avatars
// Robots for Students
const AVATAR_STUDENT_1 = `https://api.dicebear.com/9.x/bottts/svg?seed=Gizmo`;
const AVATAR_STUDENT_2 = `https://api.dicebear.com/9.x/bottts/svg?seed=Sassy`;
// Micah for Teachers, Fluent 3D Object for Parents (CDN Fixed)
const AVATAR_TEACHER = `https://api.dicebear.com/9.x/micah/svg?seed=Teacher&mouth=smile`;
const AVATAR_PARENT = `https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Animated-Fluent-Emojis@master/Emojis/Activities/Soccer%20ball.png`;

// Initial Mock Data
let USERS_STORE: User[] = [
  { 
    uid: 's1', 
    role: 'ALUMNO', 
    displayName: 'Leo Messi', 
    username: 'leo', 
    password: '123', 
    avatar: AVATAR_STUDENT_1, 
    status: 'APPROVED', 
    balance: 350, 
    xp: 1200, 
    streakWeeks: 2, 
    linkCode: '101010' 
  },
  { 
    uid: 's2', 
    role: 'ALUMNO', 
    displayName: 'Frida Kahlo', 
    username: 'frida', 
    password: '123', 
    avatar: AVATAR_STUDENT_2, 
    status: 'APPROVED', 
    balance: 120, 
    xp: 400, 
    streakWeeks: 0, 
    linkCode: '202020' 
  },
  { 
    uid: 'p1', 
    role: 'PADRE', 
    displayName: 'Sr. Messi', 
    username: 'padre', 
    password: '123', 
    avatar: AVATAR_PARENT, 
    status: 'APPROVED', 
    linkedStudentIds: ['s1'], 
    balance: 0, 
    xp: 0, 
    streakWeeks: 0 
  },
  { 
    uid: 't1', 
    role: 'MAESTRA', 
    displayName: 'Maestra Sonia', 
    username: 'maestra', 
    password: 'maestra 2701', 
    avatar: AVATAR_TEACHER, 
    status: 'APPROVED', 
    balance: 0, 
    xp: 0, 
    streakWeeks: 0 
  }
];

// Helper to generate Week ID
export const getCurrentWeekId = () => {
  const now = new Date();
  const onejan = new Date(now.getFullYear(), 0, 1);
  const week = Math.ceil((((now.getTime() - onejan.getTime()) / 86400000) + onejan.getDay() + 1) / 7);
  return `${now.getFullYear()}-W${week}`;
};

// In-memory storage (simulating Firestore)
let tasksStore: TaskLog[] = [];
let transactionsStore: Transaction[] = [];
let quizzesStore: Quiz[] = []; // Store for teacher created quizzes
let quizResultsStore: QuizResult[] = []; // Store for completed quizzes

// Static Question Bank (Expanded with Minigames)
const STATIC_QUIZ_BANK: Quiz[] = [
  // 1. Classic Text Quiz
  {
    id: 'q_text_1',
    type: 'TEXT',
    question: "Si ahorras 2 GemaBits cada día durante una semana, ¿cuántos tendrás al final?",
    options: ["10 GemaBits", "14 GemaBits", "12 GemaBits"],
    correctIndex: 1,
    reward: 50,
    difficulty: 'EASY',
    createdBy: 'TEACHER',
    assignedTo: 'ALL'
  },
  // 2. Sentence Builder (Constructor de Frases)
  {
    id: 'q_sentence_1',
    type: 'SENTENCE',
    question: "Ordena la frase secreta sobre el ahorro:",
    // The items should be shuffled by the frontend, here we store the correct order implicitly or explicitly.
    // We will assume the frontend shuffles them, and 'gameItems' is the correct order source for validation.
    gameItems: [
      { id: '1', text: 'Para' },
      { id: '2', text: 'comprar' },
      { id: '3', text: 'debo' },
      { id: '4', text: 'ahorrar' },
      { id: '5', text: 'dinero' }
    ],
    reward: 75,
    difficulty: 'MEDIUM',
    createdBy: 'TEACHER',
    assignedTo: 'ALL'
  },
  // 3. Need vs Want (Clasificación)
  {
    id: 'q_sort_1',
    type: 'SORTING',
    question: "Clasifica: ¿Es una Necesidad (Vital) o un Capricho (Deseo)?",
    gameItems: [
      { id: '1', text: 'Agua', category: 'NEED' },
      { id: '2', text: 'Juguete', category: 'WANT' },
      { id: '3', text: 'Comida', category: 'NEED' },
      { id: '4', text: 'Dulces', category: 'WANT' },
      { id: '5', text: 'Medicina', category: 'NEED' }
    ],
    reward: 100,
    difficulty: 'MEDIUM',
    createdBy: 'TEACHER',
    assignedTo: 'ALL'
  }
];

// Initialize some empty tasks...
USERS_STORE.filter(u => u.role === 'ALUMNO').forEach(student => {
  const weekId = getCurrentWeekId();
  tasksStore.push({
    id: `school-${student.uid}-${weekId}`,
    studentId: student.uid,
    weekId,
    type: 'SCHOOL',
    status: {
      'ATTENDANCE': false,
      'RESPONSIBILITY': false,
      'BEHAVIOR': false,
      'RESPECT': false,
      'PARTICIPATION': false,
    },
    updatedAt: Date.now()
  });
  tasksStore.push({
    id: `home-${student.uid}-${weekId}`,
    studentId: student.uid,
    weekId,
    type: 'HOME',
    status: {
      'CHORES': false,
      'RESPECT': false,
      'HYGIENE': false,
      'READING': false,
    },
    updatedAt: Date.now()
  });
});

export const mockService = {
  login: async (username: string, password?: string): Promise<{user?: User, error?: string}> => {
    const user = USERS_STORE.find(u => u.username === username);
    if (!user) return { error: 'Usuario no encontrado' };
    if (user.password !== password) return { error: 'Contraseña incorrecta' };
    if (user.status === 'PENDING') return { error: 'Cuenta pendiente de aprobación.' };
    return { user };
  },

  register: async (userData: Partial<User>, specialCode: string): Promise<{success: boolean, error?: string}> => {
    if (specialCode !== 'lazo123') return { success: false, error: 'Código de seguridad incorrecto' };
    if (USERS_STORE.find(u => u.username === userData.username)) return { success: false, error: 'Usuario existe' };

    // Default Avatar logic based on role
    const isStudent = userData.role === 'ALUMNO';
    const defaultAvatar = isStudent 
        ? `https://api.dicebear.com/9.x/bottts/svg?seed=${userData.username}`
        : `https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Animated-Fluent-Emojis@master/Emojis/Activities/Soccer%20ball.png`;

    const newUser: User = {
      uid: Date.now().toString(),
      role: userData.role || 'ALUMNO',
      displayName: userData.displayName || 'Nuevo Usuario',
      username: userData.username || '',
      password: userData.password,
      avatar: userData.avatar || defaultAvatar,
      status: 'PENDING',
      balance: 0,
      xp: 0,
      streakWeeks: 0,
      linkCode: userData.role === 'ALUMNO' ? Math.floor(100000 + Math.random() * 900000).toString() : undefined
    };

    USERS_STORE.push(newUser);
    
    if (newUser.role === 'ALUMNO') {
        const weekId = getCurrentWeekId();
        tasksStore.push({
            id: `school-${newUser.uid}-${weekId}`,
            studentId: newUser.uid,
            weekId,
            type: 'SCHOOL',
            status: { 'ATTENDANCE': false, 'RESPONSIBILITY': false, 'BEHAVIOR': false, 'RESPECT': false, 'PARTICIPATION': false },
            updatedAt: Date.now()
        });
        tasksStore.push({
            id: `home-${newUser.uid}-${weekId}`,
            studentId: newUser.uid,
            weekId,
            type: 'HOME',
            status: { 'CHORES': false, 'RESPECT': false, 'HYGIENE': false, 'READING': false },
            updatedAt: Date.now()
        });
    }
    return { success: true };
  },

  getStudents: async (): Promise<User[]> => USERS_STORE.filter(u => u.role === 'ALUMNO' && u.status === 'APPROVED'),
  getPendingUsers: async (): Promise<User[]> => USERS_STORE.filter(u => u.status === 'PENDING'),

  approveUser: async (uid: string) => {
    const user = USERS_STORE.find(u => u.uid === uid);
    if (user) user.status = 'APPROVED';
  },

  rejectUser: async (uid: string) => {
    USERS_STORE = USERS_STORE.filter(u => u.uid !== uid);
  },

  getStudentById: (id: string) => USERS_STORE.find(s => s.uid === id),

  updateAvatar: async (uid: string, newAvatarUrl: string) => {
      const user = USERS_STORE.find(u => u.uid === uid);
      if (user) {
          user.avatar = newAvatarUrl;
          return true;
      }
      return false;
  },

  getTasks: async (studentId: string, weekId: string = getCurrentWeekId()) => {
    return tasksStore.filter(t => t.studentId === studentId && t.weekId === weekId);
  },

  updateTaskStatus: async (studentId: string, type: 'SCHOOL' | 'HOME', key: string, value: boolean) => {
    const weekId = getCurrentWeekId();
    let task = tasksStore.find(t => t.studentId === studentId && t.weekId === weekId && t.type === type);
    
    if (task) {
      task.status[key] = value;
      const student = USERS_STORE.find(s => s.uid === studentId);
      if (student) {
        const reward = type === 'SCHOOL' ? 20 : 25;
        const change = value ? reward : -reward;
        student.balance += change;
        transactionsStore.push({
          id: Date.now().toString(),
          studentId,
          amount: change,
          description: value ? `Tarea completada: ${key}` : `Tarea revocada: ${key}`,
          timestamp: Date.now(),
          type: change > 0 ? 'EARN' : 'SPEND'
        });
      }
      return true;
    }
    return false;
  },

  linkParent: async (parentUid: string, linkCode: string) => {
    const student = USERS_STORE.find(s => s.linkCode === linkCode && s.role === 'ALUMNO');
    if (student) {
      const parent = USERS_STORE.find(p => p.uid === parentUid);
      if (parent) {
        if (!parent.linkedStudentIds) parent.linkedStudentIds = [];
        if (!parent.linkedStudentIds.includes(student.uid)) parent.linkedStudentIds.push(student.uid);
        return student;
      }
    }
    throw new Error("Código inválido");
  },

  getClassReport: async (): Promise<StudentReport[]> => {
    const students = USERS_STORE.filter(u => u.role === 'ALUMNO' && u.status === 'APPROVED');
    const weekId = getCurrentWeekId();
    return students.map(student => {
      const schoolTasks = tasksStore.find(t => t.studentId === student.uid && t.weekId === weekId && t.type === 'SCHOOL');
      const homeTasks = tasksStore.find(t => t.studentId === student.uid && t.weekId === weekId && t.type === 'HOME');
      return {
        student,
        schoolTasksCompleted: schoolTasks ? Object.values(schoolTasks.status).filter(Boolean).length : 0,
        schoolTasksTotal: schoolTasks ? Object.keys(schoolTasks.status).length : 5,
        homeTasksCompleted: homeTasks ? Object.values(homeTasks.status).filter(Boolean).length : 0,
        homeTasksTotal: homeTasks ? Object.keys(homeTasks.status).length : 4
      };
    });
  },

  createTeacherQuiz: async (quiz: Quiz) => {
    quizzesStore.push(quiz);
    return true;
  },

  getStudentQuizzes: async (studentId: string): Promise<{available: Quiz[], completed: QuizResult[]}> => {
    const completedResults = quizResultsStore.filter(r => r.studentId === studentId);
    const completedIds = completedResults.map(r => r.quizId);

    const availableTeacherQuizzes = quizzesStore.filter(q => 
        (q.assignedTo === 'ALL' || q.assignedTo === studentId) && 
        !completedIds.includes(q.id)
    );

    const availableStaticQuizzes = STATIC_QUIZ_BANK.filter(q => !completedIds.includes(q.id));

    return {
        available: [...availableTeacherQuizzes, ...availableStaticQuizzes],
        completed: completedResults
    };
  },

  submitQuiz: async (studentId: string, quizId: string, question: string, score: number, earned: number) => {
     quizResultsStore.push({
         id: Date.now().toString(),
         studentId,
         quizId,
         questionPreview: question,
         score,
         earned,
         status: 'PENDING',
         timestamp: Date.now()
     });
  },

  getPendingQuizApprovals: async () => {
    return quizResultsStore
      .filter(q => q.status === 'PENDING')
      .map(q => {
         const student = USERS_STORE.find(u => u.uid === q.studentId);
         return {
            ...q,
            studentName: student?.displayName || 'Unknown',
            studentAvatar: student?.avatar || ''
         };
      });
  },

  approveQuizRedemption: async (resultId: string) => {
    const result = quizResultsStore.find(r => r.id === resultId);
    if (result && result.status === 'PENDING') {
       result.status = 'APPROVED';
       const student = USERS_STORE.find(s => s.uid === result.studentId);
       if (student) {
          student.balance += result.earned;
          transactionsStore.push({
             id: Date.now().toString(),
             studentId: student.uid,
             amount: result.earned,
             description: 'Recompensa de Quiz (Aprobado)',
             timestamp: Date.now(),
             type: 'EARN'
          });
       }
    }
  },

  rejectQuizRedemption: async (resultId: string) => {
    const result = quizResultsStore.find(r => r.id === resultId);
    if (result) result.status = 'REJECTED';
  }
};