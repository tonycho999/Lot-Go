/**
 * 1. 잔액 표시 렌더링 (CURRENT BALANCE)
 * - app.js에서 실시간으로 감지된 coins 값을 받아 화면에 표시만 함
 * - 노란색 광고 버튼 삭제됨 (singlegame.js로 통합)
 */
export function renderBalance(coins) {
    const container = document.getElementById('balance-container');
    if (!container) return;

    // 기존의 투박한 스타일 대신, singlegame.js와 통일된 네온 글래스모피즘 디자인 적용
    container.innerHTML = `
        <div class="balance-wrapper" style="
            background: rgba(15, 23, 42, 0.6); 
            border: 1px solid #3b82f6; 
            border-radius: 16px; 
            padding: 25px 15px; 
            text-align: center; 
            margin-bottom: 30px; 
            box-shadow: 0 0 20px rgba(59, 130, 246, 0.2);
            backdrop-filter: blur(10px);
            max-width: 400px;
            margin-left: auto;
            margin-right: auto;
        ">
            <small style="
                color: #94a3b8; 
                font-size: 0.8rem; 
                display: block; 
                margin-bottom: 8px; 
                letter-spacing: 2px; 
                font-weight: 600;
                font-family: 'Exo 2', sans-serif;
            ">CURRENT BALANCE</small>
            
            <div style="
                font-size: 3rem; 
                font-weight: 900; 
                color: #ffffff; 
                font-family: 'Exo 2', sans-serif;
                text-shadow: 0 0 15px rgba(255, 255, 255, 0.4);
                line-height: 1;
            ">
                ${coins.toLocaleString()} 
                <span style="font-size: 1rem; color: #3b82f6; font-weight: 700;">COINS</span>
            </div>
        </div>
    `;
}

/**
 * 2. 탭 전환 시스템 (SINGLE, ONLINE, SHOP, PROFILE)
 */
export function switchTab(tabName) {
    const tabs = ['single', 'online', 'shop', 'profile'];
    
    // 1. 모든 탭 컨텐츠 숨기기
    tabs.forEach(t => {
        const contentEl = document.getElementById(`${t}-tab`);
        if (contentEl) {
            contentEl.style.display = (t === tabName) ? 'block' : 'none';
        }

        // 2. 하단 네비게이션 아이콘 활성화 상태 변경 (CSS 클래스 활용 권장)
        // (index.html의 nav button id가 'nav-single' 형태라고 가정)
        const navBtn = document.getElementById(`nav-${t}`);
        if (navBtn) {
            if (t === tabName) {
                navBtn.style.color = "#3b82f6"; // 활성 색상 (Blue)
                navBtn.style.opacity = "1";
            } else {
                navBtn.style.color = "#94a3b8"; // 비활성 색상 (Gray)
                navBtn.style.opacity = "0.7";
            }
        }
    });

    console.log(`Switched to ${tabName.toUpperCase()} tab`);
}
