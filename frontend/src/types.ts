export type User = {
  id: string;
  username: string;
  email?: string;
  isAdmin?: boolean;
};

export const questionDifficulties = ["Easy", "Medium", "Hard"] as const;
export type QuestionDifficulty = (typeof questionDifficulties)[number];

export type ListQuestionsResponse = {
  items: Question[];
  total: number;
  skip: number;
  take: number;
};

export type ListTopicsResponse = {
  count: number;
  topics: Topic[];
};

export type Topic = {
  id: number;
  name: string;
};

export type Question = {
  id: number;
  title: string;
  statement: string;
  difficulty: QuestionDifficulty;
  constraints?: string[];
  solutionOutline: string;
  // metadata: JsonValue | null;
  exampleIO?: { input: string; output: string }[];
  topics: { topic: Topic }[];
};

export type ListLanguagesResponse = {
  count: number;
  languages: Language[];
};

export type Language = {
  id: number;
  name: string;
};

type MatchResult =
  | {
      status: "matched";
      roomId: string;
      partnerId: string;
      startedTime?: Date;
      expiresAt?: Date;
    }
  | { status: "queued"; expiresAt: Date; startedTime?: Date }
  | { status: "cancelled"; startedTime?: Date }
  | { status: "not_found"; startedTime?: Date }
  | {
      status: "already_matched";
      roomId: string;
      partnerId: string;
      startedTime?: Date;
      expiresAt?: Date;
    };

export type MatchResponse = MatchResult & {
  subscribeUrl: string;
};

export type ListAttemptsResponse = Attempt[];
export type Attempt = {
  id: string;
  userId: string;
  collabId: string;
  question: number;
  code: string;
};
