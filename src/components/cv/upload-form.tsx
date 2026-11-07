"use client";

import { useActionState, useState } from "react";
import { Upload } from "lucide-react";

import { FormMessage } from "@/components/auth/form-message";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorState, idleState } from "@/lib/action-state";
import { CV_ACCEPT, MAX_CV_BYTES } from "@/lib/cv/upload";
import { uploadCv } from "@/server/cv/actions";

export function UploadForm() {
  const [state, action, pending] = useActionState(uploadCv, idleState);
  const [tooLarge, setTooLarge] = useState(false);

  return (
    <form action={action} className="space-y-3">
      {tooLarge ? (
        <FormMessage state={errorState("The file must be 4 MB or smaller.")} />
      ) : (
        <FormMessage state={state} />
      )}
      <div className="space-y-2">
        <Label htmlFor="cv-file">CV file</Label>
        <Input
          id="cv-file"
          name="file"
          type="file"
          accept={CV_ACCEPT}
          required
          aria-describedby="cv-file-hint"
          className="h-10 py-1.5"
          onChange={(event) => {
            const file = event.target.files?.[0];
            setTooLarge(Boolean(file && file.size > MAX_CV_BYTES));
          }}
        />
        <p id="cv-file-hint" className="text-xs text-muted-foreground">
          PDF or DOCX, up to 4 MB. Your original file is stored privately and is
          never changed.
        </p>
      </div>
      <Button type="submit" size="lg" disabled={pending || tooLarge}>
        <Upload data-icon="inline-start" />
        {pending ? "Uploading…" : "Upload CV"}
      </Button>
    </form>
  );
}
