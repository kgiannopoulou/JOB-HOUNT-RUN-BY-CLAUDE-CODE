"use client";

import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthFormProps = {
  mode: "login" | "register";
};

export function AuthForm({ mode }: AuthFormProps) {
  const isRegister = mode === "register";

  // Supabase Auth is connected in Phase 3. Until then nothing is sent or stored.
  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    toast.info("Accounts are not available yet", {
      description: "Sign-in arrives in Phase 3. Nothing you typed was sent.",
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {isRegister && (
        <div className="space-y-2">
          <Label htmlFor="name">Full name</Label>
          <Input
            id="name"
            name="name"
            autoComplete="name"
            className="h-10"
            required
          />
        </div>
      )}
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          className="h-10"
          required
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={isRegister ? "new-password" : "current-password"}
          minLength={isRegister ? 8 : undefined}
          aria-describedby={isRegister ? "password-hint" : undefined}
          className="h-10"
          required
        />
        {isRegister && (
          <p id="password-hint" className="text-xs text-muted-foreground">
            Use at least 8 characters.
          </p>
        )}
      </div>
      <Button type="submit" size="lg" className="h-10 w-full">
        {isRegister ? "Create account" : "Sign in"}
      </Button>
    </form>
  );
}
