import { useEffect, useRef, type RefObject } from "react";

const clamp = (value: number, maximum: number) => Math.max(0, Math.min(maximum, value));

export function useScrollGallery(
  section: RefObject<HTMLElement | null>,
  stage: RefObject<HTMLDivElement | null>,
  viewport: RefObject<HTMLDivElement | null>,
  signature: string,
  reducedMotion: boolean,
) {
  const geometry = useRef({ pinned: false, distance: 0, top: 88 });
  const focusFrame = useRef(0);

  useEffect(() => {
    const container = section.current;
    const content = stage.current;
    const scroller = viewport.current;
    if (!container || !content || !scroller) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const { pinned, distance, top } = geometry.current;
      if (pinned) scroller.scrollLeft = clamp(top - container.getBoundingClientRect().top, distance);
      content.style.setProperty("--gallery-progress", String(distance ? scroller.scrollLeft / distance : 0));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const measure = () => {
      const distance = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
      const height = content.offsetHeight;
      const pinned = !reducedMotion && distance > 1 && window.innerHeight >= height + 112;
      const top = Math.max(88, (window.innerHeight - height + 64) / 2);
      geometry.current = { pinned, distance, top };
      container.dataset.pinned = String(pinned);
      container.style.height = pinned ? `${height + distance}px` : "";
      content.style.setProperty("--gallery-top", `${top}px`);
      schedule();
    };
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    observer.observe(scroller);
    if (scroller.firstElementChild) observer.observe(scroller.firstElementChild);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", measure);
    scroller.addEventListener("scroll", schedule, { passive: true });
    measure();
    return () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(focusFrame.current);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", measure);
      scroller.removeEventListener("scroll", schedule);
      container.style.height = "";
      delete container.dataset.pinned;
    };
  }, [section, stage, viewport, signature, reducedMotion]);

  const goTo = (position: number, smooth = true) => {
    const container = section.current;
    const scroller = viewport.current;
    if (!container || !scroller) return;
    const { pinned, distance, top } = geometry.current;
    const left = clamp(position, distance);
    const behavior = smooth && !reducedMotion ? "smooth" : "instant";
    if (pinned) {
      window.scrollTo({ top: window.scrollY + container.getBoundingClientRect().top - top + left, behavior });
    } else {
      scroller.scrollTo({ left, behavior });
    }
  };

  return {
    goTo,
    cancelReveal: () => cancelAnimationFrame(focusFrame.current),
    move: (direction: number) => {
      const scroller = viewport.current;
      if (scroller) goTo(scroller.scrollLeft + direction * scroller.clientWidth * 0.8);
    },
    reveal: (element: HTMLElement) => {
      const scroller = viewport.current;
      if (!scroller || !geometry.current.pinned) return;
      const view = scroller.getBoundingClientRect();
      const item = element.getBoundingClientRect();
      const left = scroller.scrollLeft + item.left - view.left - (view.width - item.width) / 2;
      cancelAnimationFrame(focusFrame.current);
      focusFrame.current = requestAnimationFrame(() => goTo(left, false));
    },
  };
}
