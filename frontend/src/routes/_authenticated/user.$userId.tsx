import { Separator } from "@/components/ui/separator";
import {
  ATTEMPT_SERVICE_URL,
  QN_SERVICE_URL,
  USER_SERVICE_URL,
} from "@/constants";
import { authFetch, cn } from "@/lib/utils";
import type {
  ListAttemptsResponse,
  Question,
  QuestionDifficulty,
  User,
} from "@/types";
import {
  useQueries,
  useQuery,
  type UseQueryOptions,
} from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/user/$userId")({
  component: RouteComponent,
});

type AttemptData = {
  id: string;
  questionId: string;
  title: string;
  difficulty: QuestionDifficulty;
  code: string;
  collaborator: string;
  collaboratorId: string;
};

function RouteComponent() {
  const { auth } = Route.useRouteContext();
  const { userId } = Route.useParams();
  const { user } = auth;
  const navigate = Route.useNavigate();

  const userQueryFn = async (userId: string): Promise<User> => {
    const res = await authFetch(`${USER_SERVICE_URL}/${userId}`);
    if (!res.ok) {
      throw new Error("User response was not ok");
    }
    return res.json();
  };

  const userQuery = useQuery<User>({
    queryKey: ["user", userId],
    queryFn: () => userQueryFn(userId),
    enabled: userId !== user?.id,
  });

  const attemptsQuery = useQuery<ListAttemptsResponse>({
    queryKey: ["attempts", userId],
    queryFn: async () => {
      const res = await authFetch(`${ATTEMPT_SERVICE_URL}/${userId}`);
      if (!res.ok) {
        throw new Error("Attempts response was not ok");
      }
      return res.json();
    },
  });

  const questionQueryFn = async (questionId: number): Promise<Question> => {
    const res = await authFetch(`${QN_SERVICE_URL}/questions/${questionId}`);
    if (!res.ok) {
      throw new Error("Question response was not ok");
    }
    return res.json();
  };

  const questions = useQueries<UseQueryOptions<AttemptData>[]>({
    queries: (attemptsQuery.data ?? []).map(
      ({ question, code, collabId, id }) => ({
        queryKey: ["question", question],
        queryFn: async () => {
          const [
            { title, difficulty, id: questionId },
            { username, id: collaboratorId },
          ] = await Promise.all([
            questionQueryFn(question),
            userQueryFn(collabId),
          ]);
          return {
            id,
            title,
            difficulty,
            code,
            collaborator: username,
            collaboratorId,
            questionId: questionId.toString(),
          };
        },
        enabled: !!attemptsQuery.data,
      }),
    ),
  });

  const attempts = questions.map(({ data }) => data).filter((x) => !!x);

  return (
    <main className="mx-100 my-16 flex flex-col gap-6">
      <h1 className="text-3xl font-medium">
        {userQuery.data?.username ?? user?.username}
      </h1>
      <Separator />
      <h1 className="text-2xl font-medium">Question History</h1>
      <div>
        {attempts.map((attempt, i, arr) => (
          <div
            className="hover:bg-muted flex items-center gap-6 rounded-md p-4"
            key={i}
            onClick={() =>
              navigate({
                to: `/attempt/$attemptId`,
                params: { attemptId: attempt.id },
              })
            }
          >
            <div
              className={cn(
                "relative z-10 flex h-10 w-10 items-center justify-center rounded-full outline-2",
                {
                  "text-teal-700 outline-teal-500":
                    attempt.difficulty === "Easy",
                  "text-amber-700 outline-amber-500":
                    attempt.difficulty === "Medium",
                  "text-red-700 outline-red-500": attempt.difficulty === "Hard",
                  "after:absolute after:top-full after:h-9 after:w-[2px] after:bg-neutral-400":
                    i !== arr.length - 1,
                },
              )}
            >{`#${attempt.questionId}`}</div>
            <div className="flex flex-col">
              <span
                className={cn("text-sm font-medium", {
                  "text-teal-700": attempt.difficulty === "Easy",
                  "text-amber-700": attempt.difficulty === "Medium",
                  "text-red-700": attempt.difficulty === "Hard",
                })}
              >
                {attempt.difficulty}
              </span>
              <span>{attempt.title}</span>
            </div>

            <div className="ml-auto text-sm">
              <span className="text-muted-foreground">With: </span>
              <Link
                to={`/user/$userId`}
                params={{ userId: attempt.collaboratorId }}
                className="hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {attempt.collaborator}
              </Link>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
