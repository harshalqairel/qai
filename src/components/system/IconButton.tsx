import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type IconButtonProps = React.ComponentProps<typeof Button> & {
  label: string;
};

export default function IconButton({ label, className, children, ...props }: IconButtonProps) {
  return (
    <Button
      size="icon-sm"
      variant="ghost"
      aria-label={label}
      title={label}
      className={cn("text-muted-foreground hover:text-foreground", className)}
      {...props}
    >
      {children}
    </Button>
  );
}
