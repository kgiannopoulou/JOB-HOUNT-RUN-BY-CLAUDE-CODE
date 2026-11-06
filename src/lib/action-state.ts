export type ActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export const idleState: ActionState = { status: "idle", message: "" };

export const errorState = (message: string): ActionState => ({
  status: "error",
  message,
});

export const successState = (message: string): ActionState => ({
  status: "success",
  message,
});
