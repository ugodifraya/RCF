export type Role = 'PLAYER' | 'COACH' | 'ADMIN';
export type EventType = 'TRAINING' | 'MATCH' | 'OTHER';
export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'MAYBE' | 'PENDING';
export type HomeAway = 'HOME' | 'AWAY' | 'NEUTRAL';
export type InjuryStatus = 'ACTIVE' | 'RECOVERED';
export type QuestionType = 'TEXT' | 'MULTIPLE_CHOICE' | 'SCALE' | 'YES_NO';

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  position?: string;
  number?: number;
  createdAt?: string;
}

export interface Event {
  id: string;
  title: string;
  type: EventType;
  date: string;
  endDate?: string;
  location?: string;
  description?: string;
  createdById: string;
  createdAt: string;
  createdBy?: { firstName: string; lastName: string };
  attendances?: Attendance[];
  _count?: { attendances: number };
}

export interface Attendance {
  id: string;
  userId: string;
  eventId: string;
  status: AttendanceStatus;
  note?: string;
  user?: User;
}

export interface Question {
  id: string;
  questionnaireId: string;
  text: string;
  type: QuestionType;
  options?: string;
  order: number;
}

export interface QuestionnaireResponse {
  id: string;
  questionnaireId: string;
  userId: string;
  submittedAt: string;
  user?: User;
  answers?: QuestionAnswer[];
}

export interface QuestionAnswer {
  id: string;
  responseId: string;
  questionId: string;
  answer: string;
  question?: Question;
}

export interface Questionnaire {
  id: string;
  title: string;
  description?: string;
  createdById: string;
  createdAt: string;
  dueDate?: string;
  isActive: boolean;
  createdBy?: { firstName: string; lastName: string };
  questions?: Question[];
  responses?: QuestionnaireResponse[];
  _count?: { questions: number; responses: number };
}

export interface Match {
  id: string;
  date: string;
  opponent: string;
  location?: string;
  homeAway: HomeAway;
  scoreHome?: number;
  scoreAway?: number;
  competition?: string;
  formation?: string;
  notes?: string;
  createdAt: string;
  createdBy?: { firstName: string; lastName: string };
  playerStats?: PlayerMatchStat[];
  _count?: { playerStats: number; playerVotes?: number; ratings?: number };
}

export interface CycleTracking {
  id: string;
  userId: string;
  startDate: string;
  endDate?: string;
  painLevel?: number;
  notes?: string;
  shareWithCoach?: boolean;
  createdAt: string;
}

export interface PlayerMatchStat {
  id: string;
  matchId: string;
  userId: string;
  minutesPlayed: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  rating?: number;
  starter: boolean;
  user?: User;
  match?: Match;
}

export interface Injury {
  id: string;
  userId: string;
  type: string;
  startDate: string;
  endDate?: string;
  description?: string;
  status: InjuryStatus;
  createdAt: string;
  user?: User;
}

export interface PlayerStat {
  id: string;
  firstName: string;
  lastName: string;
  position?: string;
  number?: number;
  attendanceRate: number;
  present: number;
  absent: number;
  totalEvents: number;
  goals: number;
  assists: number;
  minutesPlayed: number;
  matchesPlayed: number;
  yellowCards: number;
  redCards: number;
  avgRating?: number;
  activeInjuries: number;
}
