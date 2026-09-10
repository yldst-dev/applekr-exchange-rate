import { Button } from "@heroui/react";
import type { Product, ExchangeRate } from "../domain/catalog";
import type { calculateExchange } from "../domain/calculate";
import { number, signed, usd, won } from "./format";
import { Arrow } from "./controls";
interface ResultPanelProps {
  selected: Product;
  rate: ExchangeRate | null | undefined;
  calculation: ReturnType<typeof calculateExchange> | null;
  excludeVat: boolean;
  stale: (value: string) => boolean;
  share: () => Promise<void>;
  copied: boolean;
  shareFailed: boolean;
}
export function ResultPanel({
  selected,
  rate,
  calculation,
  excludeVat,
  stale,
  share,
  copied,
  shareFailed,
}: ResultPanelProps) {
  return (
    <div className="result-panel" aria-live="polite">
      <div className="result-heading">
        <div className="section-label">
          <h2>가격으로 추정한 Apple 환율</h2>
        </div>
        <span className="result-basis">
          {excludeVat ? "세전 기준" : "표시 가격 기준"}
        </span>
      </div>
      {calculation && rate ? (
        <>
          <div className="result-value">
            <span>1 USD =</span>
            <strong>{number(calculation.appleRate, 2)}</strong>
            <span>원</span>
          </div>
          <div
            className={`difference ${calculation.difference > 0 ? "above" : "below"}`}
          >
            <span>
              {calculation.difference > 0 ? "+" : ""}
              {number(calculation.premiumPercent, 1)}%
            </span>
            <p>
              기준 환율보다 {won(Math.abs(calculation.difference), 2)}{" "}
              {calculation.difference >= 0 ? "높아요" : "낮아요"}
            </p>
          </div>
          <div
            className="rate-comparison"
            aria-label={`기준 환율 ${won(rate.rate, 2)}, Apple 추정 환율 ${won(calculation.appleRate, 2)}`}
          >
            <div>
              <span>기준 환율</span>
              <div className="bar-track">
                <div
                  className="market-bar"
                  style={{
                    width: `${(rate.rate / Math.max(rate.rate, calculation.appleRate)) * 100}%`,
                  }}
                />
              </div>
              <b>{won(rate.rate, 2)}</b>
            </div>
            <div>
              <span>Apple 추정</span>
              <div className="bar-track">
                <div
                  className="apple-bar"
                  style={{
                    width: `${(calculation.appleRate / Math.max(rate.rate, calculation.appleRate)) * 100}%`,
                  }}
                />
              </div>
              <b>{won(calculation.appleRate, 2)}</b>
            </div>
          </div>
        </>
      ) : (
        <div className="unavailable">
          <h3>아직 환율을 비교할 수 없습니다</h3>
          <p>
            {!rate
              ? "기준 환율을 확인한 뒤 계산 결과가 표시됩니다."
              : "양국에서 같은 사양의 공식 가격을 확인하지 못했습니다."}
          </p>
        </div>
      )}
      <div className="price-pair">
        <div>
          <span>한국 공식 가격</span>
          <strong>
            {selected.kr ? won(selected.kr.amount) : "가격 확인 불가"}
          </strong>
          <small>부가세 포함</small>
        </div>
        <div>
          <span>미국 공식 가격</span>
          <strong>
            {selected.us ? usd(selected.us.amount) : "가격 확인 불가"}
          </strong>
          <small>판매세 제외 · 일시불 기준</small>
        </div>
      </div>
      {calculation && (
        <div className="price-details">
          <div>
            <span>기준 환율로 환산한 가격{excludeVat ? " + 부가세" : ""}</span>
            <strong>{won(calculation.expectedPrice)}</strong>
          </div>
          <div>
            <span>한국 공식 가격과의 차이</span>
            <strong>{signed(calculation.priceDifference, 0)}원</strong>
          </div>
        </div>
      )}
      {((selected.kr && stale(selected.kr.checkedAt)) ||
        (selected.us && stale(selected.us.checkedAt))) && (
        <p className="basis-note" role="status">
          마지막 확인 후 36시간이 지난 가격입니다. 출처의 확인 시각을 확인해
          주세요.
        </p>
      )}
      {selected.basis === "starting" && (
        <p className="basis-note">
          시작 가격 기준입니다. 선택 옵션에 따라 가격과 환율이 달라질 수
          있습니다.
        </p>
      )}
      <div className="result-bottom">
        <span>Apple 내부 환율이 아닌 판매가 기반 추정치입니다.</span>
        <Button variant="ghost" size="sm" onPress={() => void share()}>
          {copied
            ? "링크 복사 완료"
            : shareFailed
              ? "주소창의 링크를 복사하세요"
              : "결과 공유"}
          <Arrow external />
        </Button>
      </div>
    </div>
  );
}
