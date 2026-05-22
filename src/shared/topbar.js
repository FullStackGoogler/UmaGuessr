import { initTheme, toggleTheme, setTheme, getTodayKeyEST, startCountdownTick } from './script.js';

// ─── TOPBAR INJECTION ──────────────────────────────────────────────────

/**
 * config: {
 *   subtitle: string,
 *   showStats: boolean,
 *   showCountdown: boolean,
 * }
 */
export async function initTopbar(config = {}) {
    const {
        subtitle = 'Guess the Uma Musume from the clues',
        showStats = false,
        showCountdown = false,
    } = config;

    const countdownHTML = showCountdown
        ? `<div class="header-countdown">Next daily in <span class="countdown-val">--:--:--</span></div>`
        : '';

    const statsBtn = showStats
        ? `<button class="header-btn" id="stats-btn">Stats</button>`
        : '';

    document.querySelector('header').innerHTML = `
        <h1 id="home-title" style="cursor:pointer;">Uma<span>Guessr</span></h1>
        <p>${subtitle}</p>
        ${countdownHTML}
        <div class="header-actions">
            <label class="theme-toggle" id="theme-btn" aria-label="Toggle theme">
                <input type="checkbox" id="theme-checkbox" />
                <span class="theme-track">
                    <span class="theme-thumb"></span>
                </span>
            </label>
            <button class="header-btn" id="help-btn">?</button>
            <button class="header-btn" id="updates-btn">🛠️</button>
            ${statsBtn}
        </div>
    `;

    // Inject modals into body if not already present
    if (!document.getElementById('updates-modal')) {
        const modals = document.createElement('div');
        modals.id = 'topbar-modals';
        modals.innerHTML = `
            <div class="modal-backdrop" id="howto-modal">
                <div class="modal">
                    <button class="modal-close" id="close-help-btn">&#x2715;</button>

                    <h2>How to Play</h2>

                    <div class="howto-content" id="howto-content">
                        <p><strong><span class="howto-new">New!</span> Guess the Support Card</strong></p>
                        <br>
                        <p>
                            You have <strong>6 attempts</strong> to guess the Support Card. 
                            Skipping or submitting an incorrect guess will un-pixelate the image.
                            Additional hints are revealed at Guess #3 and #5.
                        </p>

                        <br>

                        <p>
                            Only cards released on the Global version are included for now.
                        </p>

                        <br>
                        <hr>
                        <br>

                        <p><strong>Guess the Uma Musume</strong></p>
                        <br>
                        <p>
                            You have <strong>6 attempts</strong> to guess the Uma Musume.
                            Skipping or submitting an incorrect guess reveals an
                            additional bit of information about the Uma.
                        </p>

                        <br>

                        <p>
                            NPCs and/or unreleased Uma Musume are not included.
                        </p>

                        <br>
                        <hr>
                        <br>

                        <p>
                            <strong>Note:</strong> Only dailies count towards the Stats,
                            which are stored locally.
                        </p>
                    </div>
                </div>
            </div>


            <div class="modal-backdrop" id="updates-modal">
                <div class="modal">
                    <button class="modal-close" id="close-updates-btn">&#x2715;</button>
                    <h2>Updates</h2>
                    <div id="updates-content"></div>
                </div>
            </div>

            <div class="modal-backdrop" id="stats-modal">
                <div class="modal">
                    <button class="modal-close" id="close-stats-btn">&#x2715;</button>
                    <h2>Statistics</h2>
                    <div class="stats-tabs">
                        <button class="stats-tab active" id="tab-uma">🐎 Uma Musume</button>
                        <button class="stats-tab" id="tab-support">🃏 Support Card</button>
                    </div>
                    <div id="stats-content"></div>
                </div>
            </div>

        `;
        document.body.appendChild(modals);
    }

    initTheme();
    await loadChangelog();
    wireTopbarListeners(config);

    if (showCountdown) {
        startCountdownTick(config.onDayRollover || null);
    }
}

// ─── CHANGELOG ──────────────────────────────────────────────────

async function loadChangelog() {
    try {
        const res = await fetch('/assets/data/changelog.json');
        const changelog = await res.json();
        const el = document.getElementById('updates-content');
        if (!el) return;
        el.innerHTML = changelog.map((entry, i) => `
            ${i === 0 ? '' : '<hr style="margin: 1rem 0; border-color: var(--border);">'}
            <div class="update-entry">
                <div class="update-header">
                    <strong>${formatChangelogDate(entry.date)}</strong> <span class="update-version">v${entry.version}</span>
                </div>
                <ul class="update-list">
                    ${entry.changes.map(c => `<li>${c}</li>`).join('')}
                </ul>
            </div>
        `).join('');
    } catch (e) {
        const el = document.getElementById('updates-content');
        if (el) el.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;">Could not load changelog.</p>';
    }
}

function formatChangelogDate(dateStr) {
    const [y, m, d] = dateStr.split('-');
    return `${m}/${d}/${y}`;
}

// ─── STATS ──────────────────────────────────────────────────

const UMA_STATS_KEY = 'umaguessr_uma_stats';
const SUPPORT_STATS_KEY = 'umaguessr_support_stats';
 
let activeStatsTab = 'uma';
 
function loadStats(key) {
    try {
        const raw = localStorage.getItem(key);
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { played: 0, wins: 0, streak: 0, maxStreak: 0, dist: [0, 0, 0, 0, 0, 0, 0] };
}
 
function buildStatsHTML(s, emptyMessage) {
    const winPct = s.played === 0 ? 0 : Math.round((s.wins / s.played) * 100);
    const lossVal = s.losses || 0;
    const maxVal = Math.max(...[1,2,3,4,5,6].map(i => s.dist[i] || 0), lossVal, 1);
    const lossPct = Math.round((lossVal / maxVal) * 100);
 
    const distRows = [1, 2, 3, 4, 5, 6].map(i => {
        const val = s.dist[i] || 0;
        const pct = Math.round((val / maxVal) * 100);
        return `<div class="bar-row">
            <div class="bar-label">${i}</div>
            <div class="bar-track">
                <div class="bar-fill" style="width:${Math.max(pct, 2)}%">
                    ${val > 0 ? `<span class="bar-count">${val}</span>` : ''}
                </div>
            </div>
        </div>`;
    }).join('');
 
    const lossRow = `<div class="bar-row">
        <div class="bar-label" style="color:#c0393b;font-size:0.9rem;">✕</div>
        <div class="bar-track">
            <div class="bar-fill" style="width:${Math.max(lossPct, 2)}%;background:#f5c0c0;">
                ${lossVal > 0 ? `<span class="bar-count" style="color:#c0393b;">${lossVal}</span>` : ''}
            </div>
        </div>
    </div>`;
 
    return `
        <div class="stats-grid">
            <div class="stat-box"><div class="num">${s.played}</div><div class="lbl">Played</div></div>
            <div class="stat-box"><div class="num">${winPct}%</div><div class="lbl">Win Rate</div></div>
            <div class="stat-box"><div class="num">${s.streak}</div><div class="lbl">Streak</div></div>
            <div class="stat-box"><div class="num">${s.maxStreak}</div><div class="lbl">Max Streak</div></div>
        </div>
        <div class="dist-title">Guess Distribution <span style="font-weight:400;color:var(--text-muted)">(daily only)</span></div>
        ${s.played === 0 ? `<div class="no-stats">${emptyMessage}</div>` : distRows + lossRow}
    `;
}
 
function renderUmaStats() {
    const el = document.getElementById('stats-content');
    if (el) el.innerHTML = buildStatsHTML(loadStats(UMA_STATS_KEY), 'No Uma Musume daily games played yet!');
}
 
function renderSupportStats() {
    const el = document.getElementById('stats-content');
    if (el) el.innerHTML = buildStatsHTML(loadStats(SUPPORT_STATS_KEY), 'No Support Card daily games played yet!');
}
 
function openStats() {
    if (activeStatsTab === 'uma') renderUmaStats();
    else renderSupportStats();
    document.getElementById('stats-modal').classList.add('open');
}
 
function closeStats() {
    document.getElementById('stats-modal').classList.remove('open');
}

// ─── MODAL HELPERS ──────────────────────────────────────────────────

function openHelp() { document.getElementById('howto-modal').classList.add('open'); }
function closeHelp() { document.getElementById('howto-modal').classList.remove('open'); }
function openUpdates() { document.getElementById('updates-modal').classList.add('open'); }
function closeUpdates() { document.getElementById('updates-modal').classList.remove('open'); }

// ─── LISTENERS ──────────────────────────────────────────────────

function wireTopbarListeners(config) {
    document.getElementById('home-title').addEventListener('click', () => {
        window.location.href = '/';
    });
    document.getElementById('theme-checkbox').addEventListener('change', () => {
        const isDark = document.getElementById('theme-checkbox').checked;
        setTheme(isDark ? 'dark' : 'light');
    });
    document.getElementById('help-btn').addEventListener('click', openHelp);
    document.getElementById('updates-btn').addEventListener('click', openUpdates);
    document.getElementById('close-help-btn').addEventListener('click', closeHelp);
    document.getElementById('close-updates-btn').addEventListener('click', closeUpdates);

    document.getElementById('howto-modal').addEventListener('click', e => {
        if (e.target === document.getElementById('howto-modal')) closeHelp();
    });
    document.getElementById('updates-modal').addEventListener('click', e => {
        if (e.target === document.getElementById('updates-modal')) closeUpdates();
    });

    // Stats
    const statsBtn = document.getElementById('stats-btn');
    if (statsBtn) {
        statsBtn.addEventListener('click', openStats);
        document.getElementById('close-stats-btn').addEventListener('click', closeStats);
        document.getElementById('stats-modal').addEventListener('click', e => {
            if (e.target === document.getElementById('stats-modal')) closeStats();
        });

        document.getElementById('tab-uma').addEventListener('click', () => {
            activeStatsTab = 'uma';
            document.getElementById('tab-uma').classList.add('active');
            document.getElementById('tab-support').classList.remove('active');
            if (renderUmaStats) renderUmaStats();
        });
        document.getElementById('tab-support').addEventListener('click', () => {
            activeStatsTab = 'support';
            document.getElementById('tab-support').classList.add('active');
            document.getElementById('tab-uma').classList.remove('active');
            if (renderSupportStats) renderSupportStats();
        });
    }
}
