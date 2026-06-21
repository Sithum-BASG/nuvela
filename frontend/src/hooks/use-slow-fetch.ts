import { useEffect, useRef, useState } from "react";

/** Render free-tier cold-starts can take ~20–30s; after ~3s show a reassuring note. */
export function useSlowFetch(loading: boolean, thresholdMs = 3000) {
  const [isSlow, setIsSlow] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (loading) {
      timer.current = setTimeout(() => setIsSlow(true), thresholdMs);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset slow flag when fetch completes
      setIsSlow(false);
      if (timer.current) clearTimeout(timer.current);
    }
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [loading, thresholdMs]);

  return isSlow;
}
