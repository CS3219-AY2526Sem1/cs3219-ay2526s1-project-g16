import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useForm } from "react-hook-form";

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
  const form = useForm();
  return (
    <div className="flex flex-col gap-5 w-80">
      <Form {...form}>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username or Email Address</FormLabel>
              <FormControl>
                <Input placeholder="Username or Email" {...field} />
              </FormControl>
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
            </FormItem>
          )}
        />

        <Button>Login</Button>

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
