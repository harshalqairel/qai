"use client";

import { useCallback, useRef, useState } from "react";

export function useActionGuard() {
  const locked = useRef(false);
  const [pending, setPending] = useState(false);

  const run = useCallback(async (action: () => boolean | Promise<boolean>) => {
    if (locked.current) return false;
    locked.current = true;
    setPending(true);
    try {
      return await action();
    } catch {
      return false;
    } finally {
      locked.current = false;
      setPending(false);
    }
  }, []);

  return { pending, run };
}
