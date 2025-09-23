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
import { createFileRoute } from "@tanstack/react-router";
import { useForm } from "react-hook-form";

export const Route = createFileRoute("/_unauthenticated/login")({
  component: Login,
});

function Login() {
  const form = useForm();
  return (
    <div className="flex flex-col w-72 gap-5">
      <Form {...form}>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email Address</FormLabel>
              <FormControl>
                <Input placeholder="Email" {...field} />
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

        <span>New to PeerPrep? </span>
      </Form>
    </div>
  );
}
