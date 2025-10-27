export type User = {
  id: string;
  username?: string;
  email?: string;
  isAdmin?: boolean;
};

export const questionDifficulties = ["Easy", "Medium", "Hard"] as const;

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
  difficulty: (typeof questionDifficulties)[number];
  constraints?: string[];
  solutionOutline: string;
  // metadata: JsonValue | null;
  exampleIO?: { input: string; output: string }[];
  topics: { topic: Topic }[];
};
