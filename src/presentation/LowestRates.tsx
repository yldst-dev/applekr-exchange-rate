import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@heroui/react";
import type { Product } from "../domain/catalog";
import { rankProducts } from "../domain/rank-products";
import { ProductImage } from "./controls";
import { signed, won } from "./format";
import "./lowest-rates.css";

const motionQuery = "(prefers-reduced-motion: reduce)";
const subscribeMotion = (listener: () => void) => {
  const media = window.matchMedia(motionQuery);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
};

export function LowestRates({ products, marketRate, excludeVat, observedAt, onSelect }: {
  products: Product[];
  marketRate: number | null;
  excludeVat: boolean;
  observedAt: number;
  onSelect: (id: string) => void;
}) {
  const entries = useMemo(() => rankProducts(products, marketRate ?? 0, excludeVat, observedAt), [products, marketRate, excludeVat, observedAt]);
  const signature = entries.map(entry => entry.product.id).join(",");
  const viewport = useRef<HTMLDivElement>(null);
  const directionRef = useRef(1);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reducedMotion = useSyncExternalStore(subscribeMotion, () => window.matchMedia(motionQuery).matches, () => true);

  useEffect(() => {
    if (viewport.current) viewport.current.scrollLeft = 0;
  }, [signature]);

  useEffect(() => {
    const element = viewport.current;
    if (!element || paused || hovered || focused || reducedMotion || !signature) return;
    let visible = false;
    let frame = 0;
    let previous = 0;
    let position = element.scrollLeft;
    let speed = 0;
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; });
    observer.observe(element);
    const animate = (time: number) => {
      const elapsed = previous ? Math.min(time - previous, 50) : 0;
      previous = time;
      const maximum = element.scrollWidth - element.clientWidth;
      if (visible && document.visibilityState === "visible" && maximum > 0) {
        speed = Math.min(0.025, speed + elapsed * 0.000025);
        position = Math.max(0, Math.min(maximum, position + elapsed * speed * directionRef.current));
        element.scrollLeft = position;
        if (position >= maximum) { directionRef.current = -1; speed = 0; }
        else if (position <= 0) { directionRef.current = 1; speed = 0; }
      } else {
        speed = 0;
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => { cancelAnimationFrame(frame); observer.disconnect(); };
  }, [signature, paused, hovered, focused, reducedMotion]);

  const move = (direction: number) => {
    setPaused(true);
    viewport.current?.scrollBy({ left: direction * viewport.current.clientWidth * 0.8, behavior: reducedMotion ? "instant" : "smooth" });
  };

  return <section className="lowest-rates" aria-labelledby="lowest-rates-title">
    <div className="lowest-rates-heading">
      <div><h2 id="lowest-rates-title">낮은 환율부터 살펴보세요.</h2><p>모델별 최저 환율 구성, 최대 12개. {excludeVat ? "부가세 제외" : "표시 가격"} 기준입니다.</p></div>
      {entries.length > 1 && <div className="lowest-rates-actions">
        {!reducedMotion && <Button size="sm" variant="ghost" isIconOnly aria-label={paused ? "자동 이동 재개" : "자동 이동 멈춤"} onPress={() => setPaused(value => !value)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {paused ? <path d="m9 5 11 7-11 7Z" /> : <path d="M8 5v14M16 5v14" />}
          </svg>
        </Button>}
        <Button size="sm" variant="tertiary" aria-label="낮은 환율 목록 이전 보기" isIconOnly onPress={() => move(-1)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg></Button>
        <Button size="sm" variant="tertiary" aria-label="낮은 환율 목록 다음 보기" isIconOnly onPress={() => move(1)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg></Button>
      </div>}
    </div>
    {entries.length ? <div ref={viewport} className="lowest-rates-viewport" role="region" aria-label="낮은 환율순 제품 목록" tabIndex={0}
      onFocusCapture={() => setFocused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false); }}
      onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(true); }} onPointerLeave={() => setHovered(false)}
      onPointerDown={event => { if (event.pointerType === "touch") setPaused(true); }} onWheel={() => setPaused(true)}>
      <ol className="lowest-rates-list">{entries.map(({ product, appleRate, premiumPercent }, index) => <li key={product.id}>
        <button className="lowest-rate-product" onClick={() => { onSelect(product.id); document.getElementById("calculator")?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "start" }); }}>
          <div className="lowest-rate-identity"><span className="lowest-rate-rank">{index + 1}위</span><ProductImage key={product.id} product={product} small /></div>
          <strong className="lowest-rate-name">{product.name}</strong>
          <span className="lowest-rate-specification">{product.specification}{product.basis === "starting" ? " · 시작 가격" : ""}</span>
          <span className="lowest-rate-value">{won(appleRate, 2)}<small> / USD</small></span>
          <span className="lowest-rate-difference">기준 환율 대비 {signed(premiumPercent)}%</span>
        </button>
      </li>)}</ol>
    </div> : <p className="lowest-rates-empty">최근 36시간 안에 양국 가격을 확인한 제품과 기준 환율이 있어야 순위를 표시할 수 있습니다.</p>}
  </section>;
}
