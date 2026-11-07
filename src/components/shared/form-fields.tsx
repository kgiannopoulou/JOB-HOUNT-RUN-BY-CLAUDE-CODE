import { useId } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export const selectClass =
  "h-10 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50";

type Option = { value: string; label: string };

type SelectFieldProps = React.ComponentProps<"select"> & {
  label: string;
  options: readonly Option[];
};

export function SelectField({ label, options, className, ...props }: SelectFieldProps) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <select id={id} className={cn(selectClass, className)} {...props}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

type TextFieldProps = React.ComponentProps<"input"> & { label: string };

export function TextField({ label, className, ...props }: TextFieldProps) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} className={cn("h-10", className)} {...props} />
    </div>
  );
}

type TextAreaFieldProps = React.ComponentProps<"textarea"> & { label: string };

export function TextAreaField({ label, ...props }: TextAreaFieldProps) {
  const id = useId();
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} {...props} />
    </div>
  );
}
