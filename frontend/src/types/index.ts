export type Role = 'PLAYER' | 'COACH' | 'ADMIN';
export type EventType = 'TRAINING' | 'MATCH' | 'CHAMPIONSHIP' | 'FRIENDLY' | 'CUP' | 'TOURNAMENT' | 'INTERNAL' | 'OTHER';
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
  birthDate?: string | null;
  avatarUrl?: string;
  teamId?: string | null;
  createdAt?: string;
}

export interface Team {
  id: string;
  name: string;
  category?: string | null;
  inviteCode: string;
  coachId: string;
  createdAt: string;
  members?: User[];
}

export interface Event {
  id: string;
  title: string;
  type: EventType;
  subtype?: string | null;
  date: string;
  endDate?: string;
  meetingTime?: string | null;
  location?: string;
  description?: string;
  opponent?: string | null;
  roundNumber?: string | null;
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
  bodyPart?: string;
  startDate: string;
  endDate?: string;
  description?: string;
  status: InjuryStatus;
  reportedBy?: string;
  createdAt: string;
  user?: User;
}

export interface PhysicalMeasurement {
  id: string;
  userId: string;
  weight?: number | null;
  height?: number | null;
  date: string;
  createdAt: string;
}

export interface PerformanceTest {
  id: string;
  userId: string;
  type: string;
  value: number;
  unit: string;
  date: string;
  notes?: string;
  createdAt: string;
  user?: { firstName: string; lastName: string };
}

export interface PlayerStat {
  id: string;
  firstName: string;
  lastName: string;
  position?: string;
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

// Per-type color keys stored in localStorage
export const COLOR_KEYS = {
  TRAINING: 'rcf_color_training',
  MATCH: 'rcf_color_match',
  TOURNAMENT: 'rcf_color_tournament',
  OTHER: 'rcf_color_other',
} as const;

export const DEFAULT_COLORS = {
  TRAINING: '#2563eb',   // blue
  MATCH: '#16a34a',      // green
  TOURNAMENT: '#d97706', // amber
  OTHER: '#7c3aed',      // purple
} as const;

export function getEventColor(type: string): string {
  const matchTypes = ['CHAMPIONSHIP', 'FRIENDLY', 'CUP', 'INTERNAL'];
  if (type === 'TRAINING') return localStorage.getItem(COLOR_KEYS.TRAINING) || DEFAULT_COLORS.TRAINING;
  if (matchTypes.includes(type)) return localStorage.getItem(COLOR_KEYS.MATCH) || DEFAULT_COLORS.MATCH;
  if (type === 'TOURNAMENT') return localStorage.getItem(COLOR_KEYS.TOURNAMENT) || DEFAULT_COLORS.TOURNAMENT;
  return localStorage.getItem(COLOR_KEYS.OTHER) || DEFAULT_COLORS.OTHER;
}
