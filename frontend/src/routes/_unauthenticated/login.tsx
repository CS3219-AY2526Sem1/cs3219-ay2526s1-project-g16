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
import { useForm } from "react-hook-form";
import { z } from "zod";

export const Route = createFileRoute("/_unauthenticated/login")({
  validateSearch: (search) => ({
    redirect: search?.redirect?.toString(),
  }),
  beforeLoad: ({ context, search }) => {
    if (context.auth.isAuthenticated && search.redirect != null) {
      throw redirect({ to: search.redirect });
    }
  },
  component: Login,
});

function Login() {
  const loginSchema = z.object({
    usernameOrEmail: z.union([z.email("Invalid email address"), z.string()]),
    password: z.string("Password is required"),
  });

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = (data: z.infer<typeof loginSchema>) => {
    console.log(data);
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
          <Button>Login</Button>
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
