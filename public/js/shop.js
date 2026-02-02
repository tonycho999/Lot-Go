export function renderShop() {
    const container = document.getElementById('shop-tab');
    container.innerHTML = `
        <div class="shop-container">
            <h3>ITEM SHOP</h3>
            <div class="item-list">
                <div class="item-card">
                    <span>Double Prize (1회용)</span>
                    <button class="buy-btn">500 C</button>
                </div>
                <div class="item-card">
                    <span>Hint (카드 1장 미리보기)</span>
                    <button class="buy-btn">300 C</button>
                </div>
            </div>
        </div>
    `;
}
