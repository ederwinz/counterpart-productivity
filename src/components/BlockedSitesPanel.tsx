import { Lock } from "lucide-react";
import { AllowedSite, BlockedSite, BlockingMode } from "../api";
import { Card } from "./ui/card";
import { Button } from "./ui/button";
import DomainListEditor from "./DomainListEditor";

interface Props {
  mode: BlockingMode;
  onSetMode: (mode: BlockingMode) => void;
  blockedSites: BlockedSite[];
  allowedSites: AllowedSite[];
  hasPermission: boolean;
  granting: boolean;
  onGrantPermission: () => void;
  onAddBlocked: (domain: string) => Promise<void>;
  onRemoveBlocked: (id: number) => Promise<void>;
  onAddAllowed: (domain: string) => Promise<void>;
  onRemoveAllowed: (id: number) => Promise<void>;
}

export default function BlockedSitesPanel({
  mode,
  onSetMode,
  blockedSites,
  allowedSites,
  hasPermission,
  granting,
  onGrantPermission,
  onAddBlocked,
  onRemoveBlocked,
  onAddAllowed,
  onRemoveAllowed,
}: Props) {
  const isAllowlist = mode === "allowlist";

  return (
    <Card>
      <div>
        <h3 className="font-heading text-sm font-medium">Site rules</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {isAllowlist
            ? "Everything on the curated distraction list is blocked during a focus session, except the sites you approve below."
            : "These are blocked whenever a focus session is active."}
        </p>
      </div>

      <div
        role="group"
        aria-label="Blocking mode"
        className="inline-flex w-fit gap-1 rounded-lg border border-border p-1"
      >
        <button
          type="button"
          aria-pressed={!isAllowlist}
          onClick={() => onSetMode("blocklist")}
          className={`press rounded-md px-3 py-1.5 font-label text-xs uppercase transition-[background-color,box-shadow,color,scale] duration-150 [transition-timing-function:var(--ease-out)] ${
            !isAllowlist
              ? "bg-card text-foreground shadow-relief-sm ring-1 ring-foreground/10"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Block specific sites
        </button>
        <button
          type="button"
          aria-pressed={isAllowlist}
          onClick={() => onSetMode("allowlist")}
          className={`press rounded-md px-3 py-1.5 font-label text-xs uppercase transition-[background-color,box-shadow,color,scale] duration-150 [transition-timing-function:var(--ease-out)] ${
            isAllowlist
              ? "bg-card text-foreground shadow-relief-sm ring-1 ring-foreground/10"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Allow specific sites
        </button>
      </div>

      {!hasPermission && (
        <div className="reveal rounded-lg border border-secondary/40 bg-secondary/10 p-3">
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

      {isAllowlist ? (
        <DomainListEditor
          items={allowedSites}
          addPlaceholder="e.g. docs.google.com"
          emptyText="No approved sites yet — only the curated distraction list will be blocked."
          removeLabel={(domain) => `Stop approving ${domain}`}
          onAdd={onAddAllowed}
          onRemove={onRemoveAllowed}
        />
      ) : (
        <DomainListEditor
          items={blockedSites}
          addPlaceholder="e.g. twitter.com"
          emptyText="No sites blocked yet."
          removeLabel={(domain) => `Stop blocking ${domain}`}
          onAdd={onAddBlocked}
          onRemove={onRemoveBlocked}
        />
      )}
    </Card>
  );
}
