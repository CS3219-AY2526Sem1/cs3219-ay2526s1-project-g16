import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { zodResolver } from "@hookform/resolvers/zod";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

export const Route = createFileRoute("/_unauthenticated/login")({
  validateSearch: (search) => ({
    redirect: search?.redirect?.toString(),
  }),
  beforeLoad: ({ context, search }) => {
    if (context.auth.isAuthenticated) {
      throw redirect({ to: search.redirect ?? "/" });
    }
  },
  component: Login,
});

function Login() {
  const { redirect } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { auth } = Route.useRouteContext();
  const { login } = auth;
  const [isLoading, setIsLoading] = useState(false);

  const loginSchema = z.object({
    usernameOrEmail: z.union([
      z.string().min(1, "Username is required"),
      z.email("Invalid email address"),
    ]),
    password: z.string("Password is required").min(1, "Password is required"),
  });

  const form = useForm<z.infer<typeof loginSchema>>({
    defaultValues: {
      usernameOrEmail: "",
      password: "",
    },
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: z.infer<typeof loginSchema>) => {
    setIsLoading(true);
    try {
      await login(data.usernameOrEmail, data.password);
      if (redirect != null) {
        navigate({ to: redirect, search: { redirect: undefined } });
      }
    } catch (error) {
      form.setError("root", { message: (error as Error).message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Form {...form}>
        <form
          className="flex flex-col gap-5 w-80"
          onSubmit={form.handleSubmit(onSubmit)}
        >
          <FormField
            control={form.control}
            name="usernameOrEmail"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Username or Email Address</FormLabel>
                <FormControl>
                  <Input placeholder="Username or Email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <Input placeholder="Password" type="password" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {form.formState.errors.root && (
            <div className="text-red-500 text-sm text-center -my-2">
              {form.formState.errors.root.message}
            </div>
          )}

          <Button disabled={isLoading}>
            <>
              Login
              {isLoading && <LoaderCircle className="animate-spin" />}
            </>
          </Button>
        </form>

        <Separator />

        <span className="self-center">
          {"New to PeerPrep? "}
          <Link to="/register" className="text-blue-500">
            Create an account.
          </Link>
        </span>
      </Form>
    </div>
  );
}
