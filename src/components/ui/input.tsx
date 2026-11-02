import { InputHTMLAttributes, forwardRef } from "react";

import { cn } from "../../lib/utils";

export const inputClasses =
  "h-9 rounded-[10px] border border-border bg-transparent px-3 text-sm text-foreground outline-none transition-[background-color,box-shadow] duration-150 [transition-timing-function:var(--ease-out)] placeholder:text-muted-foreground hover:bg-foreground/[0.03] focus-visible:ring-3 focus-visible:ring-ring/50";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

const Input = forwardRef<HTMLInputElement, InputProps>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(inputClasses, className)} {...props} />
));
Input.displayName = "Input";

export { Input };
