// 30초 선택 시간 후 게임 시작
function renderMultiPlayPhase() {
    const header = document.getElementById('game-header');
    const board = document.getElementById('game-board');

    header.innerHTML = `
        <div class="multi-prize-panel">
            <div id="live-prize" class="prize-amount">1,000,000,000</div>
            <small>6 / 40 MULTIPLAYER</small>
        </div>
        <div class="other-players-bar">
            ${gameState.opponents.map(op => `
                <div class="op-status">
                    <img src="${op.photo}">
                    <div class="op-match-count">${op.foundCount}/6</div>
                </div>
            `).join('')}
        </div>
    `;

    // 하단 내 번호 바
    const myNumbersBar = `
        <div class="my-numbers-footer">
            ${gameState.mySelected.map(num => `
                <div id="my-target-${num}" class="target-node">${num}</div>
            `).join('')}
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', myNumbersBar);
}

// 게임 종료 처리 (상금 분배)
async function handleMultiWin(winners) {
    const shareCount = winners.length;
    const currentPrize = calculateCurrentPrize();
    const finalPrize = Math.floor(currentPrize / shareCount);

    showResultButtons(`WINNERS: ${shareCount}명 (각 ${finalPrize.toLocaleString()} C)`);
}
