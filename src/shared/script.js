// ─── Theme ──────────────────────────────────────────────────

export function initTheme() {
    const saved = localStorage.getItem('umaguessr_theme');
    setTheme(saved || 'light');
}

export function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
}

export function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('umaguessr_theme', theme);
    const checkbox = document.getElementById('theme-checkbox');
    if (checkbox) checkbox.checked = theme === 'dark';
    const lightGif = document.getElementById('home-gif-light');
    const darkGif = document.getElementById('home-gif-dark');
    if (lightGif && darkGif) {
        lightGif.style.display = theme === 'dark' ? 'none' : 'block';
        darkGif.style.display = theme === 'dark' ? 'block' : 'none';
    }
}

// ─── Time & Countdown ──────────────────────────────────────────────────

export function getTodayKeyEST() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); //YYYY-MM-DD
}

export function getMsUntilMidnightEST() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric', minute: 'numeric', second: 'numeric',
        hour12: false
    });
    const parts = formatter.formatToParts(now);
    const h = +parts.find(p => p.type === 'hour').value;
    const m = +parts.find(p => p.type === 'minute').value;
    const s = +parts.find(p => p.type === 'second').value;
    const secondsElapsed = h * 3600 + m * 60 + s;
    return (86400 - secondsElapsed) * 1000;
}

export function formatCountdown(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function startCountdownTick() {
    function tick() {
        const ms = getMsUntilMidnightEST();
        const str = formatCountdown(ms);
        document.querySelectorAll('.countdown-val').forEach(el => el.textContent = str);
        if (ms < 1000) {
            // Day rolled over — refresh daily status
            checkDailyStatus();
        }
    }
    tick();
    setInterval(tick, 1000);
}

// ─── Misc Helpers ──────────────────────────────────────────────────

// cyrb53 inspired
export function seededShuffle(arr, seed) {
    const list = [...arr];
    let s = seed;
    for (let i = list.length - 1; i > 0; i--) {
        s = Math.imul(s ^ (s >>> 15), 0x735a2d97);
        s ^= s >>> 16;
        const j = Math.abs(s) % (i + 1);
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
}

// Fuzzy Search
export function normalize(str) {
    return str
        .toLowerCase()
        .replace(/[.·•]/g, '')           // remove dots
        .replace(/&/g, 'and')            // & → and
        .replace(/['']/g, "'")           // curly apostrophes
        .replace(/[^a-z0-9'\s]/g, '')   // strip remaining punctuation
        .replace(/\s+/g, ' ')
        .trim();
}

export function buildEmojiRow(wonAttempt, maxAttempts) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const unused = isDark ? '⚫' : '⚪';
    if (wonAttempt === -1) return '🟡'.repeat(maxAttempts);
    const used = wonAttempt - 1;
    return '🟡'.repeat(used) + '🟢' + unused.repeat(maxAttempts - wonAttempt);
}
