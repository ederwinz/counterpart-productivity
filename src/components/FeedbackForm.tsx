import { FormEvent, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { CheckCircle2, TriangleAlert } from "lucide-react";

import { supabase } from "../lib/supabase";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";

type Status = "idle" | "submitting" | "sent" | "error";

export default function FeedbackForm() {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = message.trim();
    if (!trimmed) return;

    setStatus("submitting");
    try {
      if (!supabase) throw new Error("feedback backend not configured");
      const app_version = await getVersion();
      const { error } = await supabase
        .from("feedback")
        .insert({ message: trimmed, app_version, platform: "macOS" });
      if (error) throw error;
      setMessage("");
      setStatus("sent");
    } catch {
      setStatus("error");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <label htmlFor="feedback-message" className="font-label text-xs uppercase text-muted-foreground">
        Send feedback
      </label>
      <Textarea
        id="feedback-message"
        value={message}
        onChange={(e) => {
          setMessage(e.target.value);
          if (status !== "submitting") setStatus("idle");
        }}
        placeholder="Bug reports, ideas, anything that's not working the way you'd expect…"
        disabled={status === "submitting"}
      />

      <div className="flex items-center justify-between gap-3">
        <div aria-live="polite" className="min-h-4 flex items-center gap-1.5 text-xs">
          {status === "sent" && (
            <span className="flex items-center gap-1.5 text-secondary-hover">
              <CheckCircle2 className="size-3.5" aria-hidden="true" />
              Thanks — got it.
            </span>
          )}
          {status === "error" && (
            <span className="flex items-center gap-1.5 text-destructive">
              <TriangleAlert className="size-3.5" aria-hidden="true" />
              Couldn't send that. Try again?
            </span>
          )}
        </div>
        <Button type="submit" disabled={status === "submitting" || !message.trim()}>
          {status === "submitting" ? "Sending…" : "Send"}
        </Button>
      </div>
    </form>
  );
}
