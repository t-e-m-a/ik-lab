# TEMA IK Lab — GitHub Pages

미적분Ⅱ 수학 탐구용 **다관절 역기구학 경사하강법 시뮬레이터**입니다.

기존 raylib C++ 코드에 있던 **순기구학, 거리 제곱 오차, 합성함수 미분에 기반한 관절별 변화율, 모든 관절을 동시에 갱신하는 기본 경사하강법**을 HTML Canvas + JavaScript로 옮겼습니다. 백엔드나 빌드 도구 없이 GitHub Pages에서 동작합니다.

## 실행 방법

`index.html`을 브라우저에서 직접 열면 ES 모듈(`core.mjs`)의 로딩이 차단되는 브라우저가 있으므로 **로컬 웹 서버**를 사용하세요.

```sh
python -m http.server 8000
```

그 후 `http://localhost:8000/`에 접속하면 됩니다.

## GitHub Pages 게시 방법

1. GitHub에서 새 공개 저장소(repository)를 생성합니다. 예: `ik-lab`.
2. 이 ZIP의 내용물인 `index.html`, `app.js`, `core.mjs`, `styles.css`, `resources/`, `.nojekyll` 등을 저장소의 **최상위 위치**에 업로드합니다. ZIP 파일 자체를 업로드하지 않습니다.
3. GitHub 저장소에서 **Settings → Pages → Build and deployment**로 들어갑니다.
4. **Source: Deploy from a branch**, **Branch: main**, **Folder: /(root)**를 선택하고 Save 합니다.
5. 사이트 주소는 보통 `https://<username>.github.io/ik-lab/` 형식입니다. (사용자 이름과 저장소 이름에 맞게 변경)

## 사용자 지정 글꼴

원본 C++ 프로그램의 폰트 `CRoundBold_tema_Num.ttf`는 사용자가 제공한 글꼴 파일 자체가 없어서 이 ZIP에 **포함되어 있지 않습니다**. 사용자가 소유한 파일을 다음 경로에 복사하면 웹사이트에서도 같은 글꼴을 우선 사용합니다.

```
resources/CRoundBold_tema_Num.ttf
```

글꼴을 넣지 않으면 브라우저의 기본 한글 글꼴로 표시되며 기능은 동일합니다. 글꼴을 GitHub 저장소에 공개할 경우 해당 글꼴의 재배포 라이선스를 확인하세요.

## 기능

- 마우스 클릭/드래그 또는 터치로 목표점 이동
- 2~12개 관절 (기본 4개, 길이는 각각 1)
- 순수 경사하강법, 고정 학습률, 동시 각도 갱신
- 학습률, 프레임당 반복 횟수 변경
- 일시정지, 1회 계산, 초기 자세 복원, 무작위 초기 자세
- 현재 거리·제곱 오차·관절별 각도·관절별 미분값 표시
- 최근 250개의 오차 로그 그래프와 최대 최근 10,000개 기록 CSV 내보내기
- 반응형 UI: 모바일 터치 지원

**제외:** 적응형 학습률(A), 정지점 탈출(E), 관절 회전량 패널티(M). 큰 학습률에서는 오차가 증가하거나 진동할 수 있고, 모든 도함수가 0인 정지점에 멈출 수 있습니다.

## 수학

길이 1인 각 막대의 상대각이 `theta_i`라면 누적 방향 `phi_k = theta_1 + ... + theta_k` 입니다.

```
x = Σ cos(phi_k)
y = Σ sin(phi_k)
E = (x - a)^2 + (y - b)^2
D_i = 2(x-a) * (-Σ[k=i..n] sin(phi_k))
    + 2(y-b) * ( Σ[k=i..n] cos(phi_k))
theta_i(next) = theta_i - learningRate * D_i
```

각 단계의 모든 `D_i`는 **변경하기 전 같은 자세**에서 계산됩니다. 뒤쪽 막대부터 누적해 `O(n)` 연산으로 미분값을 구합니다.

## 파일

- `index.html`: UI 구조
- `styles.css`: 반응형 스타일
- `core.mjs`: 수학적 계산 (라이브러리 의존성 없음)
- `app.js`: HTML Canvas 렌더링, 입력, 애니메이션, 그래프, CSV 저장
- `tests/core.test.mjs`: 수학 코어 자동 검증 (`node tests/core.test.mjs`)
- `resources/`: 선택적 사용자 폰트 위치
- `.nojekyll`: GitHub Pages 정적 파일 서빙
