"use client";
import { useEffect, useRef } from "react";

// Placed right after a scroll list: marks it data-overflow while rows sit below the visible part, so the bottom fade only shows when there is more to scroll to.
export function FadeIfOverflow() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const list = ref.current?.previousElementSibling as HTMLElement | null;
    if (!list) return;
    // Layout offsets, not scrollHeight: the rows' slide-in transform briefly inflates scrollHeight. The list is position:relative, so offsetTop is within it.
    const last = list.lastElementChild as HTMLElement | null;
    const check = () => list.toggleAttribute("data-overflow", !!last && last.offsetTop + last.offsetHeight > list.scrollTop + list.clientHeight + 1);
    const ro = new ResizeObserver(check);
    ro.observe(list);
    list.addEventListener("scroll", check, { passive: true });
    check();
    return () => (ro.disconnect(), list.removeEventListener("scroll", check));
  }, []);
  return <span ref={ref} hidden />;
}
