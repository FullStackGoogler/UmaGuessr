import { getTodayKeyEST } from '../shared/script.js';
import { initTopbar } from '../shared/topbar.js';
import { initFooter } from '../shared/footer.js';

function getUmaDailySave() {
    try {
        const raw = localStorage.getItem('umaguessr_uma_daily');
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

function getSupportDailySave() {
    try {
        const raw = localStorage.getItem('umaguessr_support_daily');
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

function checkDailyStatuses() {
    const key = getTodayKeyEST();

    const umaSave = getUmaDailySave();
    const umaBtn = document.getElementById('uma-daily-btn');
    if (umaSave && umaSave.dateKey === key) {
        umaBtn.textContent = '🐎 Uma Musume Daily (Done ✓)';
        umaBtn.classList.add('done');
    } else {
        umaBtn.textContent = '🐎 Uma Musume Daily';
        umaBtn.classList.remove('done');
    }

    const supportSave = getSupportDailySave();
    const supportBtn = document.getElementById('support-daily-btn');
    if (supportSave && supportSave.dateKey === key) {
        supportBtn.textContent = '🃏 Support Card Daily (Done ✓)';
        supportBtn.classList.add('done');
    } else {
        supportBtn.textContent = '🃏 Support Card Daily';
        supportBtn.classList.remove('done');
    }
}

// ─── INFINITE MODAL ──────────────────────────────────────────────────

function injectInfiniteModal() {
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div class="modal-backdrop" id="infinite-modal">
            <div class="modal modal-sm">
                <button class="modal-close" id="close-infinite-btn">&#x2715;</button>
                <h2>Infinite Mode</h2>
                <p class="modal-subtitle">Which would you like to play?</p>
                <div class="infinite-options">
                    <button class="btn-infinite-option" id="infinite-uma-btn">🐎 Uma Musume</button>
                    <button class="btn-infinite-option btn-infinite-support" id="infinite-support-btn">🃏 Support Card</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const el = document.getElementById('infinite-modal');
    document.getElementById('close-infinite-btn').addEventListener('click', closeInfiniteModal);
    el.addEventListener('click', e => { if (e.target === el) closeInfiniteModal(); });
    document.getElementById('infinite-uma-btn').addEventListener('click', () => {
        window.location.href = '/uma.html?mode=infinite';
    });
    document.getElementById('infinite-support-btn').addEventListener('click', () => {
        window.location.href = '/support.html?mode=infinite';
    });
}

function openInfiniteModal() {
    document.getElementById('infinite-modal').classList.add('open');
}

function closeInfiniteModal() {
    document.getElementById('infinite-modal').classList.remove('open');
}

// ─── INIT ──────────────────────────────────────────────────

async function init() {
    await initTopbar({
        subtitle: 'Guess the Uma Musume from the clues',
        showStats: true,
        showCountdown: true,
        onDayRollover: checkDailyStatuses,
    });

    initFooter();

    injectInfiniteModal();
    checkDailyStatuses();

    document.getElementById('uma-daily-btn').addEventListener('click', () => {
        window.location.href = '/uma.html';
    });
    document.getElementById('support-daily-btn').addEventListener('click', () => {
        window.location.href = '/support.html';
    });
    document.getElementById('infinite-btn').addEventListener('click', openInfiniteModal);
}

init();
