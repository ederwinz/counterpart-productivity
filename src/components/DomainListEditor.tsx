import { FormEvent, useState } from "react";
import { Check, Plus, Trash2, X } from "lucide-react";
import { Button } from "./ui/button";

interface DomainItem {
  id: number;
  domain: string;
}

interface Props {
  items: DomainItem[];
  addPlaceholder: string;
  emptyText: string;
  removeLabel: (domain: string) => string;
  onAdd: (domain: string) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
}

export default function DomainListEditor({
  items,
  addPlaceholder,
  emptyText,
  removeLabel,
  onAdd,
  onRemove,
}: Props) {
  const [domain, setDomain] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

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
    <>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder={addPlaceholder}
          className="flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-3 focus:ring-ring/50"
        />
        <Button type="submit" disabled={submitting || !domain.trim()}>
          <Plus className="size-3.5" aria-hidden="true" />
          {submitting ? "Adding…" : "Add"}
        </Button>
      </form>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li
              key={item.id}
              className="group flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors duration-150 [transition-timing-function:var(--ease-out)] hover:bg-muted/60"
            >
              <span className="text-sm text-foreground">{item.domain}</span>
              {confirmingId === item.id ? (
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">Remove?</span>
                  <button
                    onClick={() => {
                      setConfirmingId(null);
                      onRemove(item.id);
                    }}
                    aria-label={`Confirm: ${removeLabel(item.domain)}`}
                    className="rounded-md p-1 text-destructive hover:bg-destructive/10 focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <Check className="size-3.5" aria-hidden="true" />
                  </button>
                  <button
                    onClick={() => setConfirmingId(null)}
                    aria-label="Cancel"
                    className="rounded-md p-1 text-muted-foreground hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring/50"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmingId(item.id)}
                  aria-label={removeLabel(item.domain)}
                  className="hover-reveal-icon rounded-md p-1 text-muted-foreground opacity-0 hover:bg-muted hover:text-destructive focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring/50 group-hover:opacity-100"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
