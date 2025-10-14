import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QN_SERVICE_URL } from "@/constants";
import { authFetch } from "@/lib/utils";
import {
  questionDifficulties,
  type ListQuestionsResponse,
  type Question,
} from "@/types";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon, Trash } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import { toast } from "sonner";
import z from "zod";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

const questionSchema = z.object({
  id: z.number(),
  title: z.string().min(1),
  statement: z.string().min(1),
  difficulty: z.enum(questionDifficulties),
  topicNames: z.array(z.string().min(1)),
  exampleIO: z.array(z.object({ input: z.string(), output: z.string() })),
  constraints: z.array(z.object({ constraint: z.string() })),
  solutionOutline: z.string().min(1),
  // metadata: z.any().optional(),
});

export function QuestionsForm({
  currentQuestion,
}: {
  currentQuestion: Question;
}) {
  const form = useForm<z.infer<typeof questionSchema>>({
    resolver: zodResolver(questionSchema),
    values: currentQuestion && {
      ...currentQuestion,
      topicNames: currentQuestion.topics.map(({ topic }) => topic.name),
      exampleIO: currentQuestion.exampleIO ?? [],
      constraints:
        currentQuestion.constraints?.map((constraint) => ({ constraint })) ??
        [],
    },
  });
  const exampleIOArray = useFieldArray({
    control: form.control,
    name: "exampleIO",
  });
  const constraintsArray = useFieldArray({
    control: form.control,
    name: "constraints",
  });

  const mutation = useMutation({
    mutationFn: async (data: z.infer<typeof questionSchema>) => {
      const requestData = {
        ...data,
        constraints: data.constraints.map(({ constraint }) => constraint),
      };
      const res = await authFetch(`${QN_SERVICE_URL}/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestData),
      });

      if (!res.ok) {
        throw new Error("Failed to update question");
      }

      return res.json();
    },
    onSuccess: (data: Question) => {
      queryClient.setQueryData(
        ["questions"],
        (oldData: ListQuestionsResponse) => ({
          ...oldData,
          items: oldData.items.map((d) => (d.id === data.id ? data : d)),
        }),
      );
      toast("Question successfully updated");
    },
    onError: (error: Error) => {
      toast.error(`Error updating question: ${error.message}`);
    },
  });
  const queryClient = useQueryClient();

  const onSubmit = async (data: z.infer<typeof questionSchema>) => {
    mutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form
        className="h-150 w-2/3 content-start overflow-y-auto"
        onSubmit={form.handleSubmit(onSubmit)}
      >
        <div className="flex w-full flex-wrap gap-4 p-6">
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem className="w-2/3">
                <FormLabel>Question Title</FormLabel>
                <FormControl>
                  <Input placeholder="Title" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="difficulty"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Question Difficulty</FormLabel>
                <FormControl>
                  <Select {...field} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {questionDifficulties.map((difficulty) => (
                        <SelectItem key={difficulty} value={difficulty}>
                          {difficulty}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="statement"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>Question Statement</FormLabel>
                <FormControl>
                  <Textarea placeholder="Statement" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="solutionOutline"
            render={({ field }) => (
              <FormItem className="w-full">
                <FormLabel>Solution Outline</FormLabel>
                <FormControl>
                  <Textarea placeholder="Solution Outline" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormLabel className="w-1/2">Example Inputs/Outputs</FormLabel>
          {exampleIOArray.fields.length === 0 ? (
            <div className="w-full text-center text-sm text-neutral-500">
              No example inputs/outputs
            </div>
          ) : (
            exampleIOArray.fields.map((field, i) => (
              <>
                <FormField
                  control={form.control}
                  key={field.id + "input"}
                  name={`exampleIO.${i}.input`}
                  render={({ field }) => (
                    <FormItem className="w-1/2">
                      <FormControl>
                        <Input placeholder="Input" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  key={field.id + "output"}
                  name={`exampleIO.${i}.output`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input placeholder="Output" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  className="text-destructive bg-destructive/10 hover:bg-destructive/20"
                  size="icon"
                  onClick={() => exampleIOArray.remove(i)}
                  type="button"
                >
                  <Trash />
                </Button>
              </>
            ))
          )}
          <Button
            className="mx-auto w-3/5"
            variant="secondary"
            onClick={() => exampleIOArray.append({ input: "", output: "" })}
            type="button"
          >
            Add example input/output
          </Button>

          <FormLabel className="w-1/2">Constraints</FormLabel>
          {constraintsArray.fields.length === 0 ? (
            <div className="w-full text-center text-sm text-neutral-500">
              No constraints
            </div>
          ) : (
            constraintsArray.fields.map((field, i) => (
              <>
                <FormField
                  control={form.control}
                  key={field.id + "input"}
                  name={`constraints.${i}.constraint`}
                  render={({ field }) => (
                    <FormItem className="ml-auto w-4/5">
                      <FormControl>
                        <Input placeholder="Constraint" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  className="text-destructive bg-destructive/10 hover:bg-destructive/20 mr-auto"
                  size="icon"
                  onClick={() => constraintsArray.remove(i)}
                  type="button"
                >
                  <Trash />
                </Button>
              </>
            ))
          )}
          <Button
            className="mx-auto w-3/5"
            variant="secondary"
            onClick={() => constraintsArray.append({ constraint: "" })}
            type="button"
          >
            Add constraint
          </Button>
        </div>

        <div className="border-t-1 flex w-full justify-end gap-4 p-6">
          <Button
            variant="secondary"
            disabled={!form.formState.isDirty || mutation.isPending}
            onClick={() => form.reset()}
            type="button"
          >
            Reset form
          </Button>
          <Button
            type="submit"
            disabled={!form.formState.isDirty || mutation.isPending}
          >
            {mutation.isPending && <Loader2Icon className="animate-spin" />}
            Submit changes
          </Button>
        </div>
      </form>
    </Form>
  );
}
