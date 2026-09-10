# Cloudflare Workers 배포

Workers Static Assets에서 Vite 화면과 읽기 전용 가격 데이터를 함께 제공합니다. 가격 계산은 브라우저에서 처리합니다. 수집은 GitHub Actions의 Node.js 환경에서 실행하므로 Workers 유료 요금제나 상시 서버가 필요하지 않습니다.

공개 주소는 https://applekr-exchange-rate.yldst.com 입니다. `wrangler.jsonc`의 Custom Domain 설정으로 재배포 후에도 연결을 유지합니다. Cloudflare가 도메인 연결과 인증서를 관리합니다. `workers.dev` 주소는 자동 배포에서 이전 데이터를 복구하는 주소로 계속 사용합니다.

## 자동 배포 설정

GitHub 저장소의 Settings, Secrets and variables, Actions에서 다음 값을 설정합니다.

| 종류 | 이름 | 내용 |
| --- | --- | --- |
| Secret | `CLOUDFLARE_API_TOKEN` | 배포 계정의 Workers Scripts Edit 권한과 `yldst.com` 영역의 Zone Read 및 Workers Routes Edit 권한을 가진 배포용 토큰입니다. |
| Variable | `CLOUDFLARE_ACCOUNT_ID` | 배포할 Cloudflare 계정 식별값입니다. |
| Variable | `DEPLOYED_SITE_URL` | 해당 Worker의 `https://`로 시작하는 `workers.dev` 기본 주소입니다. |

인증 값은 저장소 파일에 넣지 않습니다. 토큰의 계정 권한은 배포 계정으로, 도메인 권한은 `yldst.com`으로 제한합니다. 기존 토큰을 교체할 때는 GitHub Secret을 먼저 갱신합니다.

`.github/workflows/deploy.yml`은 `main` 푸시, 한국 시각 09:00의 일일 예약, 수동 실행에 반응합니다. 모든 검사가 통과한 경우에만 배포합니다. GitHub 예약 실행은 지연될 수 있으며, 공개 저장소에 활동이 60일 동안 없으면 예약 작업이 비활성화될 수 있습니다. GitHub Actions의 실행 상태를 확인합니다.

코드만 바뀐 경우 오늘 수집한 데이터는 재사용합니다. 일일 예약과 수동 실행의 `refresh` 선택은 가격을 다시 수집합니다. 동시에 배포가 겹치지 않도록 작업을 순서대로 실행합니다.

## 데이터 보존

배포 전에 현재 서비스의 `/api/catalog`를 읽어 이전 가격을 복구합니다. 일부 출처의 수집에 실패하면 기존 수집 정책에 따라 해당 출처의 마지막 확인값을 유지합니다. 확인 시각을 새 값처럼 바꾸지 않습니다.

기존 사이트가 404를 반환하면 최초 배포로 처리합니다. 연결 실패, 서버 오류, 잘못된 형식은 배포를 중단합니다. 제품이나 환율이 비어 있는 결과는 배포할 수 없습니다. 준비된 파일은 `data-cloudflare`에 저장하고, 빌드 시 `dist/api/catalog`와 `dist/api/health`로 내보냅니다. 이 폴더들은 저장소에 커밋하지 않습니다.

배포 데이터는 사이트 파일과 같은 버전으로 배포됩니다. 새 배포가 실패하면 현재 서비스가 유지됩니다. `/api/health`의 `ready`는 데이터가 포함됐는지를 나타내며 최신 수집 성공을 보장하지 않습니다. 수집 성공 여부는 `completedAt`, `attemptedAt`, `issues`를 함께 확인합니다.

## 로컬 검증과 수동 배포

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run prepare:cloudflare
npm run build:cloudflare
npm run deploy:cloudflare -- --dry-run
npm run preview:cloudflare
```

Wrangler에 배포 계정으로 로그인하거나 셸에서 `CLOUDFLARE_API_TOKEN`과 `CLOUDFLARE_ACCOUNT_ID`를 전달한 뒤 `npm run deploy:cloudflare`를 실행합니다. 토큰 값은 명령 인수나 로그에 넣지 않습니다.

일일 수집이나 배포에 실패하면 GitHub Actions에서 실패한 단계를 확인하고 수동 실행합니다. 이미 정상적으로 수집한 날에는 `refresh`를 끈 상태로 배포만 다시 실행할 수 있습니다.

## 링크 미리보기

첫 HTML 응답의 Open Graph와 Twitter Card 태그에 제목, 설명, 대표 이미지의 절대 주소를 제공합니다. JavaScript 실행 없이 메신저에서 정보를 읽을 수 있습니다. 제품별 공유 링크도 사이트 공통 미리보기를 사용합니다.

대표 이미지는 `public/social-card-v1.png`이며 크기는 1200×630입니다. 이미지 수정 시 macOS에서 Pillow와 기본 Apple SD Gothic Neo 서체로 `python3 scripts/generate-social-card.py`를 실행할 수 있습니다. 이미지를 바꾸면 파일 이름과 메타 태그 주소도 함께 바꿔 메신저 이미지 캐시와 구분합니다.

`yldst.com`의 공격 방어 모드 때문에 미리보기 봇에도 브라우저 확인이 요구됩니다. Cloudflare의 해당 영역에 `infra/cloudflare-link-preview.json`의 규칙을 적용합니다. 이 규칙은 자동 배포가 관리하지 않으며 별도로 유지합니다. 지정 호스트의 GET과 HEAD 요청 중 홈페이지, 대표 이미지, `robots.txt`에만 적용하고, 확인된 봇 또는 나열된 미리보기 User-Agent에 대해서만 Security Level 검사를 건너뜁니다. User-Agent는 인증 수단이 아니므로 이 예외를 비공개 경로나 API에 확대하지 않습니다.

Cloudflare의 다른 보안 검사와 도메인의 기본 보안 설정은 유지합니다. 이미 공유한 링크는 메신저에 저장된 미리보기가 남아 있을 수 있습니다.

## 참고 자료

- [Workers Static Assets](https://developers.cloudflare.com/workers/static-assets/)
- [정적 파일 응답 헤더](https://developers.cloudflare.com/workers/static-assets/headers/)
- [GitHub Actions 예약 실행](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule)
- [Wrangler 인증](https://developers.cloudflare.com/workers/wrangler/commands/general/)
