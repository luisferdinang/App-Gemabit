// Data Models reflecting the Firestore Structure Request

export type UserRole = 'MAESTRA' | 'PADRE' | 'ALUMNO';
export type UserStatus = 'PENDING' | 'APPROVED';

export interface User {
  uid: string;
  role: UserRole;
  displayName: string;
  username: string; // New: for login
  password?: string; // New: for mock auth
  avatar: string; // New: User selected avatar URL
  status: UserStatus; // New: for approval flow
  // For parents: list of linked student UIDs
  linkedStudentIds?: string[];
  // For students:
  linkCode?: string; // 6 digit code
  parentId?: string;
  balance: number; // Total MiniBits
  xp: number; // Experience points
  streakWeeks: number; // For Super GemaBit logic
}

export type TaskType = 'SCHOOL' | 'HOME';

// Specific task keys based on prompt
export type SchoolTaskKey = 'ATTENDANCE' | 'RESPONSIBILITY' | 'BEHAVIOR' | 'RESPECT' | 'PARTICIPATION';
export type HomeTaskKey = 'CHORES' | 'RESPECT' | 'HYGIENE' | 'READING';

export interface TaskLog {
  id: string; // Document ID
  studentId: string;
  weekId: string; // e.g., "2023-W42"
  type: TaskType;
  // Map of task key to boolean (completed)
  status: Record<string, boolean>;
  updatedAt: number;
}

export interface Transaction {
  id: string;
  studentId: string;
  amount: number; // Positive for earning, negative for spending
  description: string; // "School Week Completed", "Ice Cream Redemption"
  timestamp: number;
  type: 'EARN' | 'SPEND';
}

// EXPENSE REQUESTS (New)
export type ExpenseStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface ExpenseRequest {
  id: string;
  studentId: string;
  amount: number;
  description: string;
  status: ExpenseStatus;
  createdAt: number;
  // Optional mapped fields for UI
  studentName?: string;
  studentAvatar?: string;
}

// GAME TYPES
export type QuizType = 'TEXT' | 'SENTENCE' | 'SORTING' | 'BALANCE' | 'ORDERING';

export interface QuizGameItem {
  id: string;
  text: string;
  category?: 'NEED' | 'WANT'; // For sorting game
  value?: number; // For balance game (not used in item list usually, but good to have)
}

export interface Quiz {
  id: string;
  type: QuizType; // New field
  question: string; // Main instruction or question
  
  // TEXT QUIZ
  options?: string[];
  correctIndex?: number;

  // SENTENCE QUIZ
  // correctOrder provided in gameData or derived
  
  // SORTING, ORDERING, SENTENCE
  gameItems?: QuizGameItem[]; // Generic items list for games
  
  // BALANCE
  targetValue?: number;

  reward: number; // MiniBits
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  assignedTo?: string | 'ALL'; // 'ALL' or Student UID
  createdBy?: 'AI' | 'TEACHER';
}

// IN_BAG: Completed locally, waiting for student to "Cash Out"
// PENDING: Sent to teacher, waiting for approval
export type RedemptionStatus = 'IN_BAG' | 'PENDING' | 'APPROVED' | 'REJECTED';

export interface QuizResult {
  id: string; // Unique ID for the result attempt
  studentId: string;
  quizId: string;
  questionPreview: string; // To show teacher what they answered
  score: number; // 1 for pass, 0 for fail currently
  earned: number;
  status: RedemptionStatus;
  timestamp: number;
}

export interface StudentReport {
  student: User;
  schoolTasksCompleted: number;
  schoolTasksTotal: number;
  homeTasksCompleted: number;
  homeTasksTotal: number;
}

export interface AppState {
  currentUser: User | null;
  selectedStudentId: string | null; // For Teacher/Parent views
}