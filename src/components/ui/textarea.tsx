import { TextareaHTMLAttributes, forwardRef } from "react";

import { cn } from "../../lib/utils";

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "min-h-20 w-full resize-none rounded-[10px] border border-border bg-transparent px-3 py-2 text-sm text-foreground outline-none transition-[background-color,box-shadow] duration-150 [transition-timing-function:var(--ease-out)] placeholder:text-muted-foreground hover:bg-foreground/[0.03] focus-visible:ring-3 focus-visible:ring-ring/50",
        className,
      )}
      {...props}
    />
  ),
);
Textarea.displayName = "Textarea";

export { Textarea };
