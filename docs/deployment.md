# Dokploy 배포와 운영

## 서비스 설정

| 항목 | 값 |
| --- | --- |
| 배포 방식 | Docker Compose |
| Git 공급자 | GitHub |
| 저장소 | `yldst-dev/applekr-exchange-rate` |
| 브랜치 | `main` |
| Compose 경로 | `./compose.yaml` |
| 서비스 | `app` |
| 컨테이너 포트 | `3000` |
| 실행 개수 | `1` |
| 영구 볼륨 | `catalog-data` |
| 데이터 경로 | `/app/data/catalog.json` |

환경 변수는 `SYNC_HOUR_KST=9`를 사용합니다. 한국 시각 기준 자동 수집 시각이며 기본값도 9입니다. API 키나 별도 데이터베이스는 필요하지 않습니다.

Docker Stack 방식은 사용하지 않습니다. 이 프로젝트는 소스에서 이미지를 빌드하는 Compose 방식입니다. 서버의 CPU에 맞춰 Node.js 24 이미지를 사용하며 `amd64` 또는 `arm64`를 강제하지 않습니다.

## 배포 순서

1. Dokploy 프로젝트 안에 Compose 서비스를 만들고 위 저장소와 브랜치를 연결합니다.
2. Compose 파일 경로를 지정하고 환경 변수를 저장합니다.
3. 사용할 도메인의 DNS를 Dokploy 서버에 연결합니다.
4. Domains에서 도메인, 서비스 `app`, 컨테이너 포트 `3000`을 지정하고 HTTPS를 활성화합니다.
5. Preview Compose에서 해당 서비스의 도메인 라벨과 네트워크 연결을 확인합니다.
6. Deploy를 실행하고 빌드 로그 및 서비스 로그를 확인합니다.
7. `/api/health`에서 `status`가 `ok`인지 확인합니다. 최초 수집이 끝나면 `ready`가 `true`가 됩니다.
8. `/api/catalog`의 `issues`, `attemptedAt`, `completedAt`과 실제 제품 선택 및 비교 모달을 확인합니다.

도메인 연결은 [Dokploy 공식 안내](https://docs.dokploy.com/docs/core/docker-compose/domains)를 따릅니다. Dokploy가 도메인 라벨과 네트워크를 붙이므로 파일에 도메인을 고정하지 않습니다. 실제 도메인과 인증서 발급은 Dokploy에서 설정해야 합니다.

## 최초 실행과 상태 확인

빈 볼륨에서는 화면을 먼저 제공하고 가격과 환율을 수집합니다. 수집 중에도 상태 확인 주소는 응답합니다. `ready: false`는 확보된 가격이나 환율이 아직 없다는 뜻이며, 서버 프로세스 장애와 구분합니다. 일부 출처 실패는 `issues`에서 확인할 수 있습니다.

외부 통신은 Apple 공식 사이트와 Frankfurter의 HTTPS 주소를 사용합니다. 제품 이미지는 브라우저에서 Apple 이미지 서버로 요청합니다.

컨테이너는 일반 사용자로 실행하며 루트 파일 시스템은 읽기 전용입니다. 가격 데이터는 영구 볼륨에, 임시 파일은 `/tmp`에 저장합니다. 호스트 포트는 열지 않고 Dokploy의 프록시를 사용합니다.

## 갱신과 재배포

수집 일정과 캐시는 영구 볼륨에 저장됩니다. 같은 한국 날짜에는 서버를 재시작해도 다시 수집하지 않습니다. 새 버전 배포 시 기존 볼륨을 유지하고 서비스 개수는 1로 유지합니다.

수동 수집이 필요하면 같은 볼륨에 쓰는 서버를 먼저 중지한 뒤 서비스 명령으로 `node build/server/sync.js`를 1회 실행하고 서버를 다시 시작합니다. 실행 중인 서버와 별도 수집기가 동시에 같은 파일에 쓰지 않도록 합니다.

## 백업과 복구

Dokploy의 볼륨 백업 기능으로 `catalog-data`를 백업하거나, 서비스가 중지된 상태에서 `/app/data/catalog.json`을 보관합니다. 복구 후에는 볼륨의 파일을 컨테이너 사용자 `node`가 읽고 쓸 수 있어야 합니다.

기존 버전으로 돌아가려면 Dokploy에서 이전 커밋을 선택해 재배포합니다. 이때도 볼륨을 유지합니다. Compose 프로젝트 이름이나 볼륨 이름을 바꾸면 다른 볼륨이 연결될 수 있습니다. `down -v`는 저장 데이터를 삭제하므로 일반 재배포에 사용하지 않습니다.

## 로컬 컨테이너 확인

```sh
docker compose -f compose.yaml -f compose.local.yaml config --quiet
docker compose -f compose.yaml -f compose.local.yaml up --build -d
curl --fail http://localhost:8080/api/health
docker compose -f compose.yaml -f compose.local.yaml logs --tail=50 app
```

8080 포트가 사용 중이면 `APP_PORT=8081`을 명령 앞에 지정하고 해당 포트로 확인합니다. 로컬 확인용 `compose.local.yaml`은 Dokploy 배포 파일에 추가하지 않습니다.
