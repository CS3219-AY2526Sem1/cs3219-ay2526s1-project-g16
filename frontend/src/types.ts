export type User = {
  id: string;
  username?: string;
  email?: string;
  isAdmin?: boolean;
};

export const questionDifficulties = ["Easy", "Medium", "Hard"] as const;

export type ListTopicsResponse = {
  count: number;
  topics: Topic[];
};

export type Topic = {
  id: number;
  name: string;
};

export type ListLanguagesResponse = {
  count: number;
  languages: Language[];
};

export type Language = {
  id: number;
  name: string;
};
