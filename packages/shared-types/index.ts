export interface User {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'COACH' | 'TRAINEE';
  avatar?: string;
  createdAt: string;
}

export interface AiRole {
  id: string;
  name: string;
  customerType: string;
  region: string;
  position: string;
  annualRevenue: string;
  coreTags: string;
  languagePreference: string;
  communicationStyle: string;
  decisionStyle: string;
  painPoints: string;
  productFocus: string;
  personalityTraits: string;
  promptTemplate: string;
  avatarUrl?: string;
  isPreset: boolean;
  createdAt: string;
}

export interface Scenario {
  id: string;
  title: string;
  description: string;
  category: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD' | 'EXPERT';
  background: string;
  objectives: string;
  evaluationCriteria: string;
  dialogueScript?: string;
  successCriteria?: string;
  failCriteria?: string;
  isPreset: boolean;
  createdAt: string;
}

export interface TrainingSession {
  id: string;
  userId: string;
  roleId: string;
  scenarioId?: string;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED';
  startedAt: string;
  endedAt?: string;
  role?: AiRole;
  scenario?: Scenario;
}

export interface Message {
  id: string;
  sessionId: string;
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
  metadata?: string;
  createdAt: string;
}

export interface Evaluation {
  id: string;
  sessionId: string;
  dimension: string;
  score: number;
  feedback: string;
  metadata?: string;
  createdAt: string;
}

export interface Report {
  id: string;
  sessionId: string;
  userId: string;
  overallScore: number;
  radarData: string;
  strengths: string;
  weaknesses: string;
  recommendations: string;
  transcript?: string;
  createdAt: string;
}

export interface KnowledgeEntry {
  id: string;
  question: string;
  answer: string;
  category: string;
  tags?: string;
  sourceDocId?: string;
  createdAt: string;
}

export interface Document {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  parsedText?: string;
  status: 'PENDING' | 'PARSING' | 'PARSED' | 'ERROR';
  createdAt: string;
}
