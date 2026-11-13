# 자취 메이트 — APK 만들기 (PWABuilder)

## 1. 웹에 올리기 (GitHub Pages, 무료)
1. GitHub에서 새 저장소를 만든다. 이름 예: `jachwi-mate`, 공개(Public)
2. 이 폴더 안의 파일 전체(index.html, manifest.json, sw.js, css, js, data, icons)를 저장소에 업로드한다. 폴더째 올리지 말고 안의 내용물을 올려서 index.html이 맨 위에 보이게 한다.
3. 저장소 Settings → Pages → Branch: `main`, 폴더 `/ (root)` → Save
4. 1~2분 뒤 `https://내아이디.github.io/jachwi-mate/` 주소로 열리는지 확인한다.

## 2. PWABuilder에서 APK 받기
1. https://www.pwabuilder.com 접속 후 위 주소를 입력하고 Start
2. Manifest, Service Worker 항목이 초록색(통과)인지 확인
3. Package for stores → Android 선택
4. Package ID 입력 (예: `io.github.내아이디.jachwimate`), 나머지는 기본값, Generate
5. 내려받은 zip 안의 `.apk`를 폰으로 옮겨 설치한다. 설치 시 "출처를 알 수 없는 앱" 허용이 필요하다.
6. zip에 들어 있는 서명 키(signing key) 파일과 비밀번호는 잘 보관한다. 나중에 업데이트할 때 필요하다.

## 3. 업데이트할 때
파일을 수정해 다시 올린 뒤 `sw.js` 첫 줄의 `jachwi-mate-v1`을 `v2`로 올려야 기기에 새 버전이 반영된다.

## 데이터 수정
- 레시피·재료 가격: `data/recipes.js`
- 자취템 목록·가격: `data/items.js`
- 꿀팁: `data/tips.js`
