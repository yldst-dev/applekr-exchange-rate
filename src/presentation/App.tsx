import { useState } from "react";
import { Button, Input, Modal, Spinner, Switch, TextField } from "@heroui/react";
import { categories } from "../domain/catalog";
import { calculateExchange } from "../domain/calculate";
import { useCatalog } from "./use-catalog";
import { dateTime, number, signed, usd, won } from "./format";
import { Arrow, Picker, ProductImage } from "./controls";
import { ResultPanel } from "./ResultPanel";
import { LowestRates } from "./LowestRates";
import { useTheme } from "./use-theme";
import "./calculator-section.css";

export function App() {
  const { data, error, loading, refresh, observedAt } = useCatalog();
  const [category, setCategory] = useState("전체");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState(
    () => new URLSearchParams(window.location.search).get("product") ?? "",
  );
  const [excludeVat, setExcludeVat] = useState(
    () => new URLSearchParams(window.location.search).get("vat") !== "included",
  );
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const [copied, setCopied] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  const { dark, toggleTheme } = useTheme();
  const products = data?.products ?? [];
  const filtered = products.filter(
    (product) =>
      (category === "전체" || product.category === category) &&
      `${product.name} ${product.specification}`
        .toLocaleLowerCase()
        .includes(query.toLocaleLowerCase().trim()),
  );
  const selected =
    products.find((product) => product.id === selectedId) ??
    products.find(
      (product) => product.category === "iPhone" && product.kr && product.us,
    ) ??
    products.find((product) => product.kr && product.us) ??
    products[0];
  const familyItems = [
    ...new Map(
      filtered.map((product) => [
        product.family,
        { id: product.family, label: product.name },
      ]),
    ).values(),
  ];
  if (selected && !familyItems.some((item) => item.id === selected.family))
    familyItems.unshift({ id: selected.family, label: selected.name });
  const variants = selected
    ? products.filter((product) => product.family === selected.family)
    : [];
  const rate = data?.exchangeRate;
  const calculation =
    selected?.kr && selected.us && rate
      ? calculateExchange(
          selected.kr.amount,
          selected.us.amount,
          rate.rate,
          excludeVat,
        )
      : null;
  const comparableCount = products.filter(
    (product) => product.kr && product.us,
  ).length;
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / 12) - 1),
  );
  const rows = filtered.slice(currentPage * 12, currentPage * 12 + 12);
  const stale = (value: string) =>
    observedAt - Date.parse(value) > 36 * 3600_000;
  const choose = (id: string) => {
    setSelectedId(id);
    const url = new URL(window.location.href);
    url.searchParams.set("product", id);
    window.history.replaceState(null, "", url);
    setCopied(false);
  };
  const chooseCategory = (value: string) => {
    setCategory(value);
    setPage(0);
    const match =
      products.find(
        (product) =>
          (value === "전체" || product.category === value) &&
          product.kr &&
          product.us,
      ) ??
      products.find(
        (product) => value === "전체" || product.category === value,
      );
    if (match) choose(match.id);
  };
  const changeVat = (value: boolean) => {
    setExcludeVat(value);
    setCopied(false);
    setShareFailed(false);
    const url = new URL(window.location.href);
    if (value) url.searchParams.delete("vat");
    else url.searchParams.set("vat", "included");
    window.history.replaceState(null, "", url);
  };
  const share = async () => {
    try {
      const url = new URL(window.location.href);
      if (selected) url.searchParams.set("product", selected.id);
      await navigator.clipboard.writeText(url.href);
      setCopied(true);
      setShareFailed(false);
    } catch {
      setCopied(false);
      setShareFailed(true);
    }
  };
  return (
    <div className="app-shell">
      <a className="skip-link" href="#calculator">
        계산기로 바로 가기
      </a>
      <header className="site-header">
        <a className="brand" href="/" aria-label="Apple 환율 계산기 홈">
          <span>Apple 환율 계산기</span>
        </a>
        <div className="header-actions">
          <Button
            variant="ghost"
            size="sm"
            isIconOnly
            onPress={toggleTheme}
            aria-label={dark ? "밝은 화면으로 전환" : "어두운 화면으로 전환"}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              focusable="false"
            >
              {dark ? (
                <>
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42" />
                </>
              ) : (
                <path d="M20.9 13.3A9 9 0 0 1 10.7 3.1a9 9 0 1 0 10.2 10.2Z" />
              )}
            </svg>
          </Button>
        </div>
      </header>
      <main>
        <section className="intro">
          <div>
            <h1>Apple 가격에<br />담긴 환율.</h1>
          </div>
          <div className="market-summary">
            <div className="live-label">
              일일 기준 환율
            </div>
            <p className="market-rate">
              <span>1 USD</span>
              <strong>{rate ? number(rate.rate, 2) : "—"}</strong>
              <span>KRW</span>
            </p>
            <p className="muted">
              {rate
                ? `${rate.date} 공시 · 유럽중앙은행`
                : "첫 공시값을 불러오고 있습니다"}
            </p>
            <div className="update-line">
              하루 1회 자동 갱신
              <Button
                variant="ghost"
                size="sm"
                onPress={() => void refresh()}
                isDisabled={loading}
                aria-label="저장된 최신 데이터 다시 불러오기"
              >
                <svg
                  width="15"
                  height="15"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  aria-hidden="true"
                >
                  <path d="M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 6M4 12l2 6a7 7 0 0 0 12-1" />
                </svg>
              </Button>
            </div>
          </div>
        </section>
        {(error || Boolean(data?.issues.length)) && (
          <div className="notice" role="status">
            {error ??
              "일부 데이터를 갱신하지 못했습니다. 가격별 확인 시각과 데이터 출처를 확인해 주세요."}
            {error && (
              <Button
                variant="tertiary"
                size="sm"
                onPress={() => void refresh()}
              >
                다시 시도
              </Button>
            )}
          </div>
        )}
        {data?.syncing && (
          <div className="sync-status" role="status">
            <Spinner size="sm" />
            공식 스토어 가격을 확인하고 있습니다. 첫 수집에는 몇 분이 걸릴 수
            있습니다.
          </div>
        )}
        {!selected ? (
          <section
            className="empty-state"
            id="calculator"
            aria-busy={loading || data?.syncing}
          >
            <h2>
              {loading || data?.syncing
                ? "공식 가격을 준비하고 있습니다"
                : "아직 표시할 가격이 없습니다"}
            </h2>
            <p>가격 수집이 완료되면 제품과 계산 결과가 자동으로 표시됩니다.</p>
            {!loading && !data?.syncing && (
              <Button onPress={() => void refresh()}>다시 불러오기</Button>
            )}
          </section>
        ) : (
          <>
            <section id="calculator" className="calculator-section" aria-label="제품 가격과 환율 계산">
            <nav className="category-nav" aria-label="제품군 선택">
              {["전체", ...categories].map((value) => (
                <Button
                  key={value}
                  size="sm"
                  variant="ghost"
                  aria-pressed={category === value}
                  onPress={() => chooseCategory(value)}
                >
                  {value}
                </Button>
              ))}
            </nav>
            <div className="calculator-grid">
              <div className="selection-panel">
                <div className="section-label">
                  <h2>비교할 제품</h2>
                </div>
                <div className="product-preview">
                  <ProductImage key={selected.id} product={selected} />
                  <div>
                    <h3>{selected.name}</h3>
                    <p>{selected.specification}</p>
                  </div>
                </div>
                <Picker
                  label="제품"
                  value={selected.family}
                  items={familyItems}
                  onChange={(family) => {
                    const next =
                      filtered.find(
                        (product) =>
                          product.family === family && product.kr && product.us,
                      ) ??
                      products.find((product) => product.family === family);
                    if (next) choose(next.id);
                  }}
                />
                <Picker
                  label="세부 사양"
                  value={selected.id}
                  items={variants.map((product) => ({
                    id: product.id,
                    label: product.specification,
                  }))}
                  onChange={choose}
                />
                <div className="tax-setting">
                  <Switch
                    aria-label="한국 부가세 10% 제외"
                    isSelected={excludeVat}
                    onChange={changeVat}
                  >
                    <Switch.Content>
                      <Switch.Control>
                        <Switch.Thumb />
                      </Switch.Control>
                      <span>한국 부가세 10% 제외</span>
                    </Switch.Content>
                  </Switch>
                  <p>미국 세전 가격과 같은 기준으로 비교합니다.</p>
                </div>
              </div>
              <ResultPanel
                selected={selected}
                rate={rate}
                calculation={calculation}
                excludeVat={excludeVat}
                stale={stale}
                share={share}
                copied={copied}
                shareFailed={shareFailed}
              />
            </div>
            </section>
            <LowestRates products={products} marketRate={rate?.rate ?? null} excludeVat={excludeVat} observedAt={observedAt} onSelect={choose} />
            <div className="catalog-section">
              <h2>더 많은 제품을 보시겠어요?</h2>
              <Modal isOpen={catalogOpen} onOpenChange={setCatalogOpen}>
                <Button variant="primary">제품별 환율 비교 열기</Button>
                <Modal.Backdrop>
                  <Modal.Container size="lg" scroll="inside">
                    <Modal.Dialog className="catalog-dialog">
                      <Modal.CloseTrigger aria-label="제품별 환율 비교 닫기" />
                      <Modal.Header>
                        <Modal.Heading>제품별 환율 비교</Modal.Heading>
              <div className="catalog-heading">
                <div>
                  <p>
                    {number(products.length)}개 구성 수집 ·{" "}
                    {number(comparableCount)}개 구성 비교 가능 · {category} · {excludeVat ? "부가세 제외" : "부가세 포함"}
                  </p>
                </div>
                <TextField
                  aria-label="제품 검색"
                  value={query}
                  onChange={(value) => {
                    setQuery(value);
                    setPage(0);
                  }}
                  className="search-field"
                >
                  <Input placeholder="제품명, 용량으로 검색" />
                </TextField>
              </div>
                      </Modal.Header>
                      <Modal.Body className="catalog-body">
              <div className="table-scroll" key={`${currentPage}:${query}:${category}`} tabIndex={0} role="region" aria-label="제품별 가격 비교 목록">
                <table>
                  <caption className="sr-only">
                    제품별 공식 가격 및 Apple 추정 환율
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">제품 / 사양</th>
                      <th scope="col">한국 가격</th>
                      <th scope="col">미국 가격</th>
                      <th scope="col">Apple 추정 환율</th>
                      <th scope="col">기준 환율과 차이</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((product) => {
                      const result =
                        product.kr && product.us && rate
                          ? calculateExchange(
                              product.kr.amount,
                              product.us.amount,
                              rate.rate,
                              excludeVat,
                            )
                          : null;
                      return (
                        <tr
                          key={product.id}
                          data-selected={selected.id === product.id}
                        >
                          <td>
                            <button
                              className="product-row-button"
                              onClick={() => {
                                choose(product.id);
                                setCatalogOpen(false);
                                document
                                  .getElementById("calculator")
                                  ?.scrollIntoView({
                                    behavior: window.matchMedia(
                                      "(prefers-reduced-motion: reduce)",
                                    ).matches
                                      ? "instant"
                                      : "smooth",
                                    block: "start",
                                  });
                              }}
                            >
                              <ProductImage
                                key={product.id}
                                product={product}
                                small
                              />
                              <span>
                                <strong>{product.name}</strong>
                                <small>{product.specification}</small>
                              </span>
                            </button>
                          </td>
                          <td>
                            {product.kr ? won(product.kr.amount) : "미확인"}
                          </td>
                          <td>
                            {product.us ? usd(product.us.amount) : "미확인"}
                          </td>
                          <td className="table-rate">
                            {result ? won(result.appleRate, 2) : "비교 불가"}
                          </td>
                          <td
                            className={
                              result
                                ? result.difference > 0
                                  ? "above-text"
                                  : "below-text"
                                : "muted"
                            }
                          >
                            {result ? `${signed(result.premiumPercent)}%` : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {!filtered.length && (
                <div className="no-results">
                  <h3>검색 결과가 없습니다.</h3>
                  <p>다른 제품명이나 용량을 입력해 주세요.</p>
                  <Button
                    variant="secondary"
                    onPress={() => {
                      setQuery("");
                      setCategory("전체");
                    }}
                  >
                    검색 초기화
                  </Button>
                </div>
              )}
                      </Modal.Body>
                      <Modal.Footer className="catalog-footer">
              <div className="catalog-pagination">
                <span>
                  {number(filtered.length)}개 구성 중{" "}
                  {filtered.length ? currentPage * 12 + 1 : 0}–
                  {Math.min((currentPage + 1) * 12, filtered.length)}
                </span>
                <div>
                  <Button
                    variant="tertiary"
                    size="sm"
                    isDisabled={currentPage === 0}
                    onPress={() => setPage(currentPage - 1)}
                  >
                    이전
                  </Button>
                  <Button
                    variant="tertiary"
                    size="sm"
                    isDisabled={(currentPage + 1) * 12 >= filtered.length}
                    onPress={() => setPage(currentPage + 1)}
                  >
                    다음
                  </Button>
                </div>
              </div>
                      </Modal.Footer>
                    </Modal.Dialog>
                  </Modal.Container>
                </Modal.Backdrop>
              </Modal>
            </div>
            <section className="method-section">
              <div>
                <h2>계산 방법과 출처</h2>
              </div>
              <div className="method-content">
                <details open>
                  <summary>Apple 환율은 어떻게 계산하나요?</summary>
                  <p>
                    세전 기준에서는 한국 공식 가격을 1.1로 나눈 뒤 미국 공식
                    가격으로 나눕니다. 표시 가격 기준에서는 한국 가격을 미국
                    가격으로 바로 나눕니다. 가격 차이에는 환율 외에 지역별 가격
                    정책 등이 반영될 수 있습니다.
                  </p>
                  <div className="formula">
                    한국 가격 ÷ {excludeVat ? "1.1 ÷ " : ""}미국 가격 = Apple
                    추정 환율
                  </div>
                </details>
                <details>
                  <summary>어떤 제품과 가격을 비교하나요?</summary>
                  <p>
                    한국·미국 Apple 공식 스토어의 제품군과 Apple 제작 액세서리를
                    자동 수집합니다. 모델·용량·색상·연결 방식 등 확인 가능한
                    옵션이 일치하는 구성끼리 비교합니다. Mac은 칩·메모리·저장
                    장치·디스플레이가 일치하는 표준 구성을 연결하며, 국가별
                    키보드와 전원 어댑터 구성은 다를 수 있습니다. Watch는 기본
                    밴드가 포함된 시작 가격입니다. 주문 제작 추가 옵션, 보상
                    판매, 교육 할인, 통신사 약정 할인, 구독 서비스는 계산에
                    포함하지 않습니다. 양국의 판매 여부나 사양 확인 범위가
                    다르면 비교 불가로 표시합니다.
                  </p>
                </details>
                <details>
                  <summary>데이터 출처와 마지막 확인 시각</summary>
                  <div className="source-list">
                    {selected.kr && (
                      <p>
                        <a
                          href={selected.kr.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Apple 한국 공식 가격 <Arrow external />
                        </a>
                        <span>
                          {dateTime(selected.kr.checkedAt)}
                          {stale(selected.kr.checkedAt) ? " · 오래된 가격" : ""}
                        </span>
                      </p>
                    )}
                    {selected.us && (
                      <p>
                        <a
                          href={selected.us.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Apple 미국 공식 가격 <Arrow external />
                        </a>
                        <span>
                          {dateTime(selected.us.checkedAt)}
                          {stale(selected.us.checkedAt) ? " · 오래된 가격" : ""}
                        </span>
                      </p>
                    )}
                    {rate && (
                      <p>
                        <a href={rate.url} target="_blank" rel="noreferrer">
                          {rate.source}
                          <Arrow external />
                        </a>
                        <span>
                          {rate.date} 공시 · {dateTime(rate.fetchedAt)} 조회
                        </span>
                      </p>
                    )}
                    <p>다음 수집: {dateTime(data?.nextSyncAt)} (한국 시각)</p>
                    <p>
                      휴일에는 마지막 영업일의 공시값이 표시됩니다. 실제 카드
                      결제 환율 및 수수료와는 다를 수 있습니다.
                    </p>
                  </div>
                </details>
                {Boolean(data?.issues.length) && (
                  <details>
                    <summary>
                      갱신하지 못한 데이터 {data?.issues.length}건
                    </summary>
                    <ul className="issue-list">
                      {data?.issues.map((issue, index) => (
                        <li key={index}>
                          <span>{issue.message}</span>
                          <small>{issue.source}</small>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>
            </section>
          </>
        )}
      </main>
      <footer>
        <span>Apple 환율 계산기</span>
        <p>Apple과 관계없는 독립적인 가격 비교 서비스입니다.</p>
        <a
          href="https://www.apple.com/kr/store"
          target="_blank"
          rel="noreferrer"
        >
          Apple 공식 스토어
          <Arrow external />
        </a>
      </footer>
    </div>
  );
}
