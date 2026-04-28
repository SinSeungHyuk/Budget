# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 성격

개인용 가계부 PWA. **빌드 도구·번들러·프레임워크·외부 의존성 일절 없음.** `index.html`이 직접 `script.js`/`style.css`를 로드하는 정적 사이트. Fraunces·Manrope 웹폰트만 Google Fonts에서 가져옴.

## 개발/실행

- **개발 서버 없음.** 정적 파일 서빙만 하면 됨. 한 줄 예시: `python -m http.server 8000` 후 `http://localhost:8000`.
- `file://`로 직접 열어도 동작하지만, PWA 매니페스트와 일부 모바일 동작 검증을 위해서는 HTTP 서버를 권장.
- **테스트/린터 없음.** 추가 요청이 없는 한 도입하지 말 것 (사용자가 의존성 없는 상태를 의도함).
- 모바일 중심 UI라 데스크톱 브라우저의 device toolbar(아이폰 SE 정도 폭)로 확인하는 것이 빠름.

## 아키텍처 핵심

### 단일 상태 객체

전역 `state = { currentMonth, expenses[], budgets{} }`가 하나뿐이고, `localStorage` 키 `budget_v1_state`에 통째로 직렬화됨 (`script.js:5`, `script.js:21-23`).

- 모든 변경은 `state`를 직접 수정한 뒤 `saveState()` → `render()` 흐름.
- **마이그레이션 정책**: 스키마가 바뀌면 `STATE_KEY`를 `budget_v2_state`로 올리고 기존 키에서 변환하는 코드를 추가. `defaultState()`는 `Object.assign`으로 누락 필드를 채워주므로 필드 추가만 하는 변경은 별도 마이그레이션 없이도 안전.

### 렌더 모델

매 화면 전환마다 `app.innerHTML = ''` 후 처음부터 다시 만듦 (`render()` at `script.js:90`). 가상 DOM·diff 없음. 항목 수가 많지 않다는 전제. 새 화면을 추가할 때는 `render()`의 라우트 분기에 케이스를 추가.

`el(html)` 헬퍼로 `<template>`을 거쳐 단일 요소를 만든 뒤 이벤트 바인딩하는 패턴. innerHTML로 사용자 입력을 넣을 때는 반드시 `escapeHtml()`을 통과시킬 것 (`memo`, `category`).

### 라우팅

해시 기반. `#/` = 홈, `#/category/<인코딩된 카테고리>` = 상세 (`script.js:70-78`). 라우트 추가 시 `parseRoute()`와 `render()` 양쪽을 수정.

### 제스처 시스템

**커스텀 구현이며 라이브러리 아님.** 두 헬퍼가 핵심:

- `bindLongPress(target, onPress, onLong, threshold=480)` (`script.js:446`) — 짧게 누르면 `onPress`, 길게 누르면 `onLong`. 이동 임계값 8px 넘으면 취소. 마우스/터치 모두 지원. 카드의 "탭=상세 / 롱프레스=예산 설정" 분기가 이 함수 위에 서있음.
- `bindSwipeDelete(target, onDelete, threshold=90)` (`script.js:491`) — 좌측 스와이프 90px 이상이면 삭제 애니메이션 후 콜백. 수직 스크롤(ddy>ddx)을 먼저 감지해 lock하기 때문에 리스트 안에서도 충돌 없이 동작.

새 인터랙션을 만들 때는 두 헬퍼를 재사용하거나 같은 패턴(touchstart/move/end + mouse 이벤트 동시 등록, `passive: true` 적절히 사용)을 따를 것.

### 모달

`#modal-root`에 backdrop+modal 한 쌍을 동적으로 삽입했다가 닫힐 때 `setTimeout`으로 제거 (`script.js:279`). 동시에 여러 모달을 열지 않음 — `openModal()`은 호출 시 기존 모달을 즉시 제거함. 모달 콘텐츠는 HTML 문자열로 전달하고 호출부에서 querySelector로 바인딩.

금액 입력은 `attachAmountFormatter()` (`script.js:301`)로 입력 도중 천단위 콤마를 자동 적용 — 새 금액 입력 필드도 동일한 패턴을 따라야 함.

### 카테고리

`CATEGORIES` 배열이 `script.js:6`에 하드코딩. UI 정렬·예산 모달·카테고리 칩·라우트 검증 모두 이 배열을 참조하므로, 카테고리 변경은 한 곳만 수정하면 됨. **단**, 사용자 데이터에 옛 카테고리 이름이 남아있을 수 있어, 카테고리를 제거·이름변경 하면 `getCategoryTotals`가 그 지출을 어디에도 합산하지 않게 됨에 주의.

### 날짜 정책

`makeRecordDate(monthStr)` (`script.js:60`)이 "현재 보고 있는 달"에 따라 분기:
- 현재 달이면 `new Date()` (지금 시각).
- 과거/미래 달이면 그 달의 마지막 날 12:00.

지출은 항상 `state.currentMonth`에 귀속됨 — 즉 사용자가 임의 날짜를 직접 지정하는 UI는 없음. 날짜 지정 기능을 추가하려면 이 함수와 입력 모달 양쪽을 손봐야 함.

### 디자인 토큰 (style.css `:root`)

`--paper / --ink / --olive / --warn` 4계열 + 라인 색(`--rule*`) + 라운드(`--r*`) + ease 곡선 2종. 새 색을 인라인으로 박지 말고 변수에 추가할 것. Fraunces variable axis(`opsz`, `SOFT`)를 적극 사용 — 같은 폰트로 우아한 차이를 내는 것이 디자인의 골자.

`@media (min-width: 481px)`에서 데스크톱 가상 폰 프레임으로 전환하는 점만 주의 — 가운데 480px 컬럼 외 영역은 회색 배경이 됨.

### 애니메이션

진입 애니메이션은 `animation-delay`를 인라인 스타일로 인덱스 기반 산출 (`renderHome` 안 `50 + i * 55ms`, `renderCategory`의 `30 + i * 30ms`). 항목이 매우 많아질 경우 마지막 항목이 늦게 등장하므로 상한을 두는 식으로 수정해야 할 수 있음.

월 전환은 `fade-leave` → render → `fade-enter-l/r` 시퀀스 (`changeMonth` `script.js:201`). 좌/우 방향에 따라 시작 위치가 다름.

## PWA

`manifest.json`은 있지만 **service worker는 미구현**. 오프라인 캐시·설치 후 자동 업데이트 등이 필요하면 `sw.js`를 만들고 `index.html`에서 등록해야 함. 현재는 모바일 홈화면 추가 시 단독 창으로 뜨는 정도까지만 지원.
