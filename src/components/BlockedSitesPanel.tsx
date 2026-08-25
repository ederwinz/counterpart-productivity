import { FormEvent, useState } from "react";
import { Lock, Plus, Trash2 } from "lucide-react";
import { BlockedSite } from "../api";
import { Card } from "./ui/card";
import { Button } from "./ui/button";

interface Props {
  sites: BlockedSite[];
  hasPermission: boolean;
  granting: boolean;
  onGrantPermission: () => void;
  onAdd: (domain: string) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
}

export default function BlockedSitesPanel({
  sites,
  hasPermission,
  granting,
  onGrantPermission,
  onAdd,
  onRemove,
}: Props) {
  const [domain, setDomain] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!domain.trim()) return;
    setSubmitting(true);
    try {
      await onAdd(domain.trim());
      setDomain("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <div>
        <h3 className="font-heading text-sm font-medium">Blocked sites</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          These are blocked whenever a focus session is active.
        </p>
      </div>

      {!hasPermission && (
        <div className="rounded-lg border border-secondary/40 bg-secondary/10 p-3">
          <p className="text-xs text-secondary-hover">
            Focus needs one-time permission to edit your system's site list. You'll see a macOS
            password prompt once — after that, blocking works automatically.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={onGrantPermission}
            disabled={granting}
            className="mt-2"
          >
            <Lock className="size-3.5" aria-hidden="true" />
            {granting ? "Requesting…" : "Grant permission"}
          </Button>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="e.g. twitter.com"
          className="flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-3 focus:ring-ring/50"
        />
        <Button type="submit" disabled={submitting || !domain.trim()}>
          <Plus className="size-3.5" aria-hidden="true" />
          {submitting ? "Adding…" : "Add"}
        </Button>
      </form>

      {sites.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sites blocked yet.</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {sites.map((s) => (
            <li
              key={s.id}
              className="group flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-muted/60"
            >
              <span className="text-sm text-foreground">{s.domain}</span>
              <button
                onClick={() => {
                  if (window.confirm(`Stop blocking "${s.domain}"?`)) onRemove(s.id);
                }}
                aria-label={`Remove ${s.domain}`}
                className="rounded-md p-1 text-muted-foreground opacity-0 transition hover:bg-muted hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 group-hover:opacity-100"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
