import { LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

type ActionButtonProps = React.ComponentProps<typeof Button> & {
  loading: boolean;
  loadingText: string;
};

export default function ActionButton({ loading, loadingText, children, disabled, ...props }: ActionButtonProps) {
  return (
    <Button disabled={loading || disabled} aria-busy={loading} {...props}>
      {loading && <LoaderCircle className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
      {loading ? loadingText : children}
    </Button>
  );
}
