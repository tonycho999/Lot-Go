// ... 기존 import 문 ...
import { renderProfile } from './profile.js';
import { renderShop } from './shop.js'; // [추가] 상점 모듈

// ... (중략) ...

// [3] 탭 전환 함수 수정
window.switchTab = async (tabName) => {
    // 1. 모든 탭 숨기기
    document.querySelectorAll('.tab-content').forEach(el => el.style.display = 'none');
    
    // 2. 선택된 탭 보이기
    const targetTab = document.getElementById(`${tabName}-tab`);
    if (targetTab) targetTab.style.display = 'block';

    // 3. 버튼 활성화 스타일
    document.querySelectorAll('.bottom-nav button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(`nav-${tabName}`).classList.add('active');

    // [핵심] 4. 탭별 로직 실행
    const user = auth.currentUser;
    if (!user) return; // 로그인 안됐으면 중단

    if (tabName === 'single') {
        // 기존 싱글 메뉴 렌더링
        // (import된 함수라면 호출, 아니면 기존 방식 유지)
        if (typeof renderSingleMenu === 'function') renderSingleMenu();
    } 
    else if (tabName === 'shop') {
        // [추가] 상점 렌더링
        await renderShop(user);
    } 
    else if (tabName === 'profile') {
        // 프로필 렌더링
        await renderProfile(user);
    }
};
// ... (나머지 코드 유지) ...
