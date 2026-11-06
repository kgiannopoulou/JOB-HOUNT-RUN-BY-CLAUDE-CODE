import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { AuthForm } from "@/components/auth/auth-form";
import { errorState, successState } from "@/lib/action-state";

const fields = [
  { name: "email", label: "Email", type: "email", autoComplete: "email" },
] as const;

describe("AuthForm", () => {
  it("shows the error the action returns", async () => {
    const action = vi.fn(async () => errorState("That is not right."));
    render(<AuthForm action={action} fields={[...fields]} submitLabel="Go" />);

    await userEvent.type(screen.getByLabelText("Email"), "a@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Go" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "That is not right.",
    );
  });

  it("shows success as a status message", async () => {
    const action = vi.fn(async () => successState("Check your email."));
    render(<AuthForm action={action} fields={[...fields]} submitLabel="Go" />);

    await userEvent.type(screen.getByLabelText("Email"), "a@example.com");
    await userEvent.click(screen.getByRole("button", { name: "Go" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Check your email.",
    );
  });

  it("shows an error passed in from an expired link", () => {
    render(
      <AuthForm
        action={vi.fn()}
        fields={[...fields]}
        submitLabel="Go"
        initialError="That link has expired."
      />,
    );
    expect(screen.getByRole("alert")).toHaveTextContent("expired");
  });

  it("passes the redirect target along", () => {
    const { container } = render(
      <AuthForm
        action={vi.fn()}
        fields={[...fields]}
        submitLabel="Go"
        next="/jobs/saved"
      />,
    );
    expect(container.querySelector('input[name="next"]')).toHaveValue(
      "/jobs/saved",
    );
  });
});
