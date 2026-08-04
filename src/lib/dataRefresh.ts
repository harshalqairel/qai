const DATA_REFRESH_EVENT = "qai:data-refresh";

export function emitDataRefresh() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(DATA_REFRESH_EVENT));
}

export function subscribeToDataRefresh(handler: () => void): () => void {
  if (typeof window === "undefined") return () => undefined;
  window.addEventListener(DATA_REFRESH_EVENT, handler);
  return () => window.removeEventListener(DATA_REFRESH_EVENT, handler);
}
