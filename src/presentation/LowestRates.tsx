import { useMemo, useRef, useSyncExternalStore } from "react";
import { Button } from "@heroui/react";
import type { Product } from "../domain/catalog";
import { rankProducts } from "../domain/rank-products";
import { ProductImage } from "./controls";
import { signed, won } from "./format";
import { useScrollGallery } from "./use-scroll-gallery";
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
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const pointerFocus = useRef(false);
  const reducedMotion = useSyncExternalStore(subscribeMotion, () => window.matchMedia(motionQuery).matches, () => true);

  const { move, goTo, reveal, cancelReveal } = useScrollGallery(section, stage, viewport, signature, reducedMotion);

  return <section ref={section} className="lowest-rates" aria-labelledby="lowest-rates-title">
    <div ref={stage} className="lowest-rates-stage">
    <div className="lowest-rates-heading">
      <div><h2 id="lowest-rates-title">낮은 환율부터 살펴보세요.</h2><p>모델별 최저 환율 구성, 최대 12개. {excludeVat ? "부가세 제외" : "표시 가격"} 기준입니다.</p></div>
      {entries.length > 1 && <div className="lowest-rates-actions">
        <Button size="sm" variant="tertiary" aria-label="낮은 환율 목록 이전 보기" isIconOnly onPress={() => move(-1)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m14 6-6 6 6 6" /></svg></Button>
        <Button size="sm" variant="tertiary" aria-label="낮은 환율 목록 다음 보기" isIconOnly onPress={() => move(1)}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="m10 6 6 6-6 6" /></svg></Button>
      </div>}
    </div>
    {entries.length ? <div ref={viewport} className="lowest-rates-viewport" role="region" aria-label="낮은 환율순 제품 목록" tabIndex={0}
      onPointerDownCapture={() => { pointerFocus.current = true; }}
      onPointerUpCapture={() => { pointerFocus.current = false; }}
      onPointerCancel={() => { pointerFocus.current = false; }}
      onFocusCapture={event => { if (!pointerFocus.current && event.target instanceof HTMLElement && event.target.matches(".lowest-rate-product")) reveal(event.target); }}
      onKeyDown={event => {
        pointerFocus.current = false;
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
          event.preventDefault();
          move(event.key === "ArrowRight" ? 1 : -1);
        } else if (event.target === event.currentTarget && ["Home", "End"].includes(event.key)) {
          event.preventDefault();
          goTo(event.key === "Home" ? 0 : event.currentTarget.scrollWidth);
        }
      }}>
      <ol className="lowest-rates-list">{entries.map(({ product, appleRate, premiumPercent }, index) => <li key={product.id}>
        <button className="lowest-rate-product" onClick={() => { cancelReveal(); onSelect(product.id); document.getElementById("calculator")?.scrollIntoView({ behavior: reducedMotion ? "instant" : "smooth", block: "start" }); }}>
          <div className="lowest-rate-identity"><span className="lowest-rate-rank">{index + 1}위</span><ProductImage key={product.id} product={product} small /></div>
          <strong className="lowest-rate-name">{product.name}</strong>
          <span className="lowest-rate-specification">{product.specification}{product.basis === "starting" ? " · 시작 가격" : ""}</span>
          <span className="lowest-rate-value">{won(appleRate, 2)}<small> / USD</small></span>
          <span className="lowest-rate-difference">기준 환율 대비 {signed(premiumPercent)}%</span>
        </button>
      </li>)}</ol>
    </div> : <p className="lowest-rates-empty">최근 36시간 안에 양국 가격을 확인한 제품과 기준 환율이 있어야 순위를 표시할 수 있습니다.</p>}
    {entries.length > 1 && <div className="lowest-rates-progress" aria-hidden="true"><span /></div>}
    </div>
  </section>;
}
