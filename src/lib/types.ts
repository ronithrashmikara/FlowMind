export type SourceKind = 'pdf' | 'pptx' | 'docx' | 'txt' | 'md';

export interface Source {
  id: string;
  filename: string;
  kind: SourceKind;
  pages: number;
  words: number;
  addedAt: number;
}

/** A retrievable passage of a source, with a human-readable locator such as "p. 4" or "slide 7". */
export interface Chunk {
  id: string;
  sourceId: string;
  filename: string;
  locator: string;
  text: string;
  embedding?: number[];
}

export type ConceptKind = 'topic' | 'concept' | 'detail';

export interface Concept {
  id: string;
  name: string;
  definition: string;
  kind: ConceptKind;
  importance: number;
  chunkIds: string[];
}

export type RelationType = 'prerequisite_of' | 'part_of' | 'example_of' | 'related_to';

export interface Relation {
  id: string;
  source: string;
  target: string;
  type: RelationType;
  label?: string;
}

export type Mastery = 'new' | 'learning' | 'struggling' | 'mastered';

export interface ConceptProgress {
  correct: number;
  wrong: number;
  mastery: Mastery;
}

export type AgentId = 'parsing' | 'embedding' | 'concepts' | 'relations' | 'teaching' | 'critic';
export type AgentState = 'idle' | 'running' | 'done' | 'error';

export interface AgentStatus {
  state: AgentState;
  detail?: string;
}

export interface Citation {
  n: number;
  chunkId: string;
  filename: string;
  locator: string;
  text: string;
}

export interface CriticReport {
  attempt: number;
  verdict: 'pass' | 'revise';
  score: number;
  issues: string[];
  unsupported_claims: string[];
}

export interface TutorAnswer {
  answer: string;
  check_question?: string;
  followups: string[];
  concepts_used: string[];
  verified: boolean;
  attempts: number;
  critic: CriticReport[];
  citations: Citation[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  result?: TutorAnswer;
  error?: string;
}

export interface SummaryResult {
  title: string;
  tldr: string;
  sections: { heading: string; bullets: string[] }[];
  key_terms: { term: string; definition: string }[];
  citations: Citation[];
}

export interface QuizQuestion {
  concept: string;
  question: string;
  options: string[];
  answer_index: number;
  explanation: string;
  citation?: number;
}

export interface Flashcard {
  front: string;
  back: string;
  concept: string;
  citation?: number;
}

export interface PracticeSet {
  focus?: string;
  questions: QuizQuestion[];
  flashcards: Flashcard[];
  citations: Citation[];
}

export interface Workspace {
  version: 3;
  title: string;
  overview: string;
  sources: Source[];
  chunks: Chunk[];
  concepts: Concept[];
  relations: Relation[];
  progress: Record<string, ConceptProgress>;
  chat: ChatMessage[];
  summary?: SummaryResult;
  practice?: PracticeSet;
}

export const emptyWorkspace = (): Workspace => ({
  version: 3,
  title: '',
  overview: '',
  sources: [],
  chunks: [],
  concepts: [],
  relations: [],
  progress: {},
  chat: [],
});
