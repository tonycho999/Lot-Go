export const SINGLE_MODES = {
    1: { name: 'EASY', pick: 2, total: 5, cost: 100, max: 500, cols: 5 },
    2: { name: 'NORMAL', pick: 4, total: 10, cost: 200, max: 30000, cols: 5 },
    3: { name: 'HARD', pick: 6, total: 20, cost: 500, max: 12000000, cols: 5 }
};

export function renderSingleMenu() {
    const container = document.getElementById('single-tab');
    container.innerHTML = `
        <div class="menu-list">
            <button class="mode-btn easy" onclick="initSingleGame(1)">EASY (2/5)</button>
            <button class="mode-btn normal" onclick="initSingleGame(2)">NORMAL (4/10)</button>
            <button class="mode-btn hard" onclick="initSingleGame(3)">HARD (6/20)</button>
        </div>
    `;
}
