import { toast } from "sonner";

const SUCCESS_DURATION = 3000;
const ERROR_DURATION = 5000;

export const notify = {
  success(message: string) {
    toast.success(message, { duration: SUCCESS_DURATION });
  },
  error(message: string) {
    toast.error(message, { duration: ERROR_DURATION });
  },
  warning(message: string) {
    toast.warning(message, { duration: ERROR_DURATION });
  },
  info(message: string) {
    toast.info(message, { duration: SUCCESS_DURATION });
  },
};

