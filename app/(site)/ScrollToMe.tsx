"use client";
import { useEffect, useRef } from "react";

// Placed in the logged-in Entrant's own row: once on load, scrolls the list (never the page) so that row sits in view.
export function ScrollToMe() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const row = ref.current?.closest("li");
    const list = row?.closest("ol");
    if (!row || !list) return;
    const [r, l] = [row.getBoundingClientRect(), list.getBoundingClientRect()];
    const top = list.scrollTop + r.top - l.top - (list.clientHeight - r.height) / 2;
    list.scrollTo({ top, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, []);
  return <span ref={ref} hidden />;
}
