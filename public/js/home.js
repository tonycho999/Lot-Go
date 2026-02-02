export function renderBalance(coins) {
    const container = document.getElementById('balance-container');
    container.innerHTML = `
        <div class="balance-card">
            <small>CURRENT BALANCE</small>
            <div class="coin-display">${coins.toLocaleString()} COINS</div>
        </div>
    `;
}

export function switchTab(tabName) {
    const tabs = ['single', 'multi', 'profile'];
    tabs.forEach(t => {
        document.getElementById(`${t}-tab`).style.display = (t === tabName) ? 'block' : 'none';
    });
}
