let allChars = [];
let allImages = [];
let currentChar = null;
let currentImages = null;
let attempt = 0;
let selectedGuess = '';
let gameMode = null; // 'daily' | 'infinite'
let dailyComplete = false;
const MAX_ATTEMPTS = 6;

// ─── DATA LOADING ────────────────────────────────────────────────────────────

async function loadData() {
    initTheme();
    try {
        const [infoRes, imgRes] = await Promise.all([
            fetch('assets/data/characterInfos.json'),
            fetch('assets/data/characterImages.json')
        ]);
        allChars = await infoRes.json();
        allImages = await imgRes.json();
        document.getElementById('loading').style.display = 'none';
        document.getElementById('start-screen').style.display = 'block';
        checkDailyStatus();
        startCountdownTick();
    } catch (e) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent =
            'Could not load character data. Make sure characterInfos.json and characterImages.json are in the same folder as this file.';
    }
}

// ─── DAILY LOGIC ─────────────────────────────────────────────────────────────

function getTodayKeyEST() {
    return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); //YYYY-MM-DD
}

function getMsUntilMidnightEST() {
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

// cyrb53 inspired
function seededShuffle(arr, seed) {
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

function getDailyChar() {
    const key = getTodayKeyEST();

    const startDate = new Date('2026-05-05T12:00:00Z');
    const today = new Date(key + 'T12:00:00Z');
    const daysSinceStart = Math.floor((today - startDate) / 86400000);

    const cycle = Math.floor(daysSinceStart / allChars.length);
    const dayInCycle = daysSinceStart % allChars.length;

    const shuffled = seededShuffle(allChars, cycle + 1);
    return shuffled[dayInCycle];
}

function checkDailyStatus() {
    const key = getTodayKeyEST();
    const saved = getDailySave();
    if (saved && saved.dateKey === key) {
        dailyComplete = true;
        document.getElementById('daily-btn').textContent = 'Daily (Done ✓)';
        document.getElementById('daily-btn').classList.add('done');
    } else {
        dailyComplete = false;
        document.getElementById('daily-btn').textContent = 'Daily';
        document.getElementById('daily-btn').classList.remove('done');
    }
}

function getDailySave() {
    try {
        const raw = localStorage.getItem('umaguessr_daily');
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

function saveDailyResult(won, attemptNum) {
    const key = getTodayKeyEST();
    localStorage.setItem('umaguessr_daily', JSON.stringify({
        dateKey: key,
        won,
        attemptNum,
        charName: currentChar.name_en
    }));
}

// ─── COUNTDOWN ───────────────────────────────────────────────────────────────

function formatCountdown(ms) {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function startCountdownTick() {
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

// ─── GAME START ───────────────────────────────────────────────────────────────

function startDaily() {
    if (dailyComplete) {
        // Show result of already-completed daily
        showCompletedDaily();
        return;
    }
    gameMode = 'daily';
    currentChar = getDailyChar();
    beginGame();
}

function startInfinite() {
    gameMode = 'infinite';
    currentChar = allChars[Math.floor(Math.random() * allChars.length)];
    beginGame();
}

function beginGame() {
    attempt = 0;
    selectedGuess = '';
    const imgEntry = allImages.find(x => x.web_id === currentChar.id);
    currentImages = imgEntry ? imgEntry.images : null;

    document.getElementById('start-screen').style.display = 'none';
    document.getElementById('result-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
    document.getElementById('clues-container').innerHTML = '';
    document.getElementById('wrong-guesses').innerHTML = '';
    document.getElementById('guess-input').value = '';
    document.getElementById('guess-section').style.display = 'block';

    // Show mode badge
    const badge = document.getElementById('mode-badge');
    if (gameMode === 'daily') {
        badge.textContent = '📅 Daily Challenge';
        badge.style.display = 'inline-flex';
    } else {
        badge.textContent = '∞ Infinite Mode';
        badge.style.display = 'inline-flex';
    }

    buildProgressDots();
    renderClue(0);
}

function showCompletedDaily() {
    const saved = getDailySave();
    gameMode = 'daily';
    currentChar = getDailyChar();
    const imgEntry = allImages.find(x => x.web_id === currentChar.id);
    currentImages = imgEntry ? imgEntry.images : null;
    attempt = saved.won ? saved.attemptNum - 1 : MAX_ATTEMPTS - 1;
    lastWonAttempt = saved.won ? saved.attemptNum : -1;

    document.getElementById('start-screen').style.display = 'none';
    showResult(saved.won, true);
}

// ─── GAME FLOW ────────────────────────────────────────────────────────────────

function buildProgressDots() {
    const el = document.getElementById('progress-dots');
    el.innerHTML = '';
    for (let i = 0; i < MAX_ATTEMPTS; i++) {
        const d = document.createElement('div');
        d.className = 'dot';
        d.id = `dot-${i}`;
        el.appendChild(d);
    }
}

function markDot(idx, type) {
    const d = document.getElementById(`dot-${idx}`);
    if (d) d.className = `dot ${type}`;
}

function renderClue(idx) {
    const container = document.getElementById('clues-container');
    const c = currentChar;

    if (idx === 0) {
        const card = document.createElement('div');
        card.className = 'clue-card';
        card.innerHTML = `
      <div class="clue-row">
        <div>
          <div class="clue-label">Strengths</div>
          <div class="clue-content">${c.strengths || '—'}</div>
        </div>
        <div>
          <div class="clue-label">Weaknesses</div>
          <div class="clue-content">${c.weaknesses || '—'}</div>
        </div>
      </div>`;
        container.appendChild(card);
    }

    if (idx === 1) {
        const card = document.createElement('div');
        card.className = 'clue-card';
        card.innerHTML = `<div class="clue-label">Ear Fact</div><div class="clue-content">${c.ears_fact || '—'}</div>`;
        container.appendChild(card);
    }

    if (idx === 2) {
        const card = document.createElement('div');
        card.className = 'clue-card';
        card.innerHTML = `<div class="clue-label">Tail Fact</div><div class="clue-content">${c.tail_fact || '—'}</div>`;
        container.appendChild(card);
    }

    if (idx === 3) {
        const card = document.createElement('div');
        card.className = 'clue-card';
        card.innerHTML = `<div class="clue-label">Family Fact</div><div class="clue-content">${c.family_fact || '—'}</div>`;
        container.appendChild(card);
    }

    if (idx === 4) {
        const card = document.createElement('div');
        card.className = 'clue-card';
        card.innerHTML = `<div class="clue-label">Voice Line</div>${c.voice
            ? `<audio controls src="${c.voice}"></audio>`
            : '<div class="clue-content">No voice clip available.</div>'}`;
        container.appendChild(card);
    }

    if (idx === 5) {
        const racewearImg = getRacewearImage();
        const card = document.createElement('div');
        card.className = 'clue-card';
        card.innerHTML = `<div class="clue-label">Blurred Racewear</div>
      ${racewearImg
            ? `<div class="blurred-img-wrap"><img src="${racewearImg}" alt="blurred racewear" /></div>`
            : '<div class="clue-content">No image available.</div>'}`;
        container.appendChild(card);
    }
}

function getRacewearImage() {
    if (!currentImages) return null;
    const racewear = currentImages.find(g => g.label_en === 'Racewear');
    if (!racewear || !racewear.images || racewear.images.length === 0) return null;
    const sorted = [...racewear.images].sort((a, b) => new Date(b.uploaded) - new Date(a.uploaded));
    return sorted[0].image;
}

function submitGuess() {
    const input = document.getElementById('guess-input').value.trim();
    const guess = selectedGuess || input;
    if (!guess) return;

    const normalizedGuess = normalize(guess);
    const correctName = normalize(currentChar.name_en);

    if (normalizedGuess === correctName) {
        markDot(attempt, 'correct');
        showResult(true);
    } else {
        markDot(attempt, 'used');
        addWrongGuess(guess);
        attempt++;
        document.getElementById('guess-input').value = '';
        selectedGuess = '';
        closeAutocomplete();

        if (attempt >= MAX_ATTEMPTS) {
            showResult(false);
        } else {
            renderClue(attempt);
        }
    }
}

function skipAttempt() {
    markDot(attempt, 'used');
    attempt++;
    document.getElementById('guess-input').value = '';
    selectedGuess = '';
    closeAutocomplete();

    if (attempt >= MAX_ATTEMPTS) {
        showResult(false);
    } else {
        renderClue(attempt);
    }
}

function addWrongGuess(name) {
    const wrap = document.getElementById('wrong-guesses');
    const tag = document.createElement('span');
    tag.className = 'wrong-tag';
    tag.textContent = name;
    wrap.appendChild(tag);
}

function showResult(correct, isReplay = false) {
    lastWonAttempt = correct ? attempt + 1 : -1;

    if (!isReplay) {
        if (gameMode === 'daily') {
            recordResult(correct, correct ? attempt + 1 : 6);
            saveDailyResult(correct, correct ? attempt + 1 : 6);
            dailyComplete = true;
            document.getElementById('daily-btn').textContent = 'Daily (Done ✓)';
            document.getElementById('daily-btn').classList.add('done');
        }
        // infinite mode: no stats recorded
    }

    document.getElementById('game-screen').style.display = 'none';
    document.getElementById('guess-section').style.display = 'none';
    document.getElementById('result-screen').style.display = 'block';

    const c = currentChar;
    const racewearImg = getRacewearImage();

    const bannerClass = correct ? 'correct' : 'wrong';
    const bannerTitle = correct ? `Correct! 🎉` : `The answer was...`;
    const bannerSub = correct
        ? `You got it on attempt ${attempt + 1}!`
        : `Better luck next time!`;

    const modeTag = gameMode === 'daily'
        ? `<div class="result-mode-tag">📅 Daily Challenge</div>`
        : `<div class="result-mode-tag infinite">∞ Infinite Mode</div>`;

    let hintsHTML = '';
    const hints = [
        { label: 'Profile', val: c.profile },
        { label: 'Strengths', val: c.strengths },
        { label: 'Weaknesses', val: c.weaknesses },
        { label: 'Ear fact', val: c.ears_fact },
        { label: 'Tail fact', val: c.tail_fact },
        { label: 'Family fact', val: c.family_fact },
    ];
    hints.forEach(h => {
        if (h.val) hintsHTML += `<div class="hint-row"><div class="hl">${h.label}</div><div class="hv">${h.val}</div></div>`;
    });

    // Countdown for daily result
    const countdownHTML = gameMode === 'daily'
        ? `<div class="result-countdown">
            <div class="result-countdown-label">Next daily in</div>
            <div class="countdown-val result-countdown-val">--:--:--</div>
           </div>
           <div style="text-align:center; padding: 0.75rem 1.5rem 1.25rem;">
                <button id="share-btn" onclick="shareResult()" class="btn-share">Share</button>
           </div>`
        : '';

    document.getElementById('result-card').innerHTML = `
    ${modeTag}
    <div class="result-banner ${bannerClass}">
      <h2>${bannerTitle}</h2>
      <p>${bannerSub}</p>
    </div>
    <div class="result-char">
      ${c.sns_icon ? `<img src="${c.sns_icon}" alt="${c.name_en}" />` : ''}
      <div class="result-char-info">
        <h3>${c.name_en}</h3>
        <p>${c.name_jp || ''}</p>
        <p>${c.slogan || ''}</p>
      </div>
    </div>
    ${racewearImg ? `<img class="reveal-img" src="${racewearImg}" alt="Racewear" />` : ''}
    <div class="hints-summary">${hintsHTML}</div>
    ${countdownHTML}
  `;

    const playAgainBtn = document.getElementById('play-again-btn');
    if (gameMode === 'daily') {
        playAgainBtn.textContent = 'Play Infinite Mode';
    } else {
        playAgainBtn.textContent = 'Play Again';
    }
}

function generateShareText() {
    const date = getTodayKeyEST().split('-').reverse().join('/').replace(/(\d+)\/(\d+)\/(\d+)/, '$2/$1/$3');
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const unused = isDark ? '⚫' : '⚪';

    let emojiRow = '';
    if (lastWonAttempt === -1) { // Failed — all yellow
        emojiRow = '🟡'.repeat(MAX_ATTEMPTS);
    } else {
        const usedAttempts = lastWonAttempt - 1; // wrong guesses before correct
        emojiRow += '🟡'.repeat(usedAttempts);   // wrong/skipped
        emojiRow += '🟢';                        // correct
        emojiRow += unused.repeat(MAX_ATTEMPTS - lastWonAttempt); // unused
    }

    return `UmaGuessr ${date}\n🐎 ${emojiRow}\n\nhttps://www.umaguessr.com`;
}

async function shareResult() {
    const text = generateShareText();
    try {
        await navigator.clipboard.writeText(text);
        const btn = document.getElementById('share-btn');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Share', 2000);
    } catch (e) {
        // Fallback for browsers that block clipboard
        prompt('Copy this to share:', text);
    }
}

function resetGame() {
    document.getElementById('result-screen').style.display = 'none';

    if (gameMode === 'daily') {
        gameMode = 'infinite'; // update mode
        startInfinite();
    } else {
        startInfinite();
    }
}

// ─── FUZZY SEARCH ─────────────────────────────────────────────────────────────

function normalize(str) {
    return str
        .toLowerCase()
        .replace(/[.·•]/g, '')           // remove dots
        .replace(/&/g, 'and')            // & → and
        .replace(/['']/g, "'")           // curly apostrophes
        .replace(/[^a-z0-9'\s]/g, '')   // strip remaining punctuation
        .replace(/\s+/g, ' ')
        .trim();
}

// ─── AUTOCOMPLETE ─────────────────────────────────────────────────────────────

const guessInput = document.getElementById('guess-input');
const acList = document.getElementById('autocomplete-list');
let acIndex = -1;

guessInput.addEventListener('input', () => {
    selectedGuess = '';
    const val = normalize(guessInput.value);
    if (!val) { closeAutocomplete(); return; }

    const matches = allChars.filter(c =>
        c.name_en && normalize(c.name_en).includes(val)
    ).slice(0, 8);

    if (!matches.length) { closeAutocomplete(); return; }

    acList.innerHTML = '';
    acIndex = -1;
    matches.forEach((c) => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.innerHTML = `${c.sns_icon ? `<img src="${c.sns_icon}" alt="" />` : ''}<span>${c.name_en}</span>`;
        item.addEventListener('mousedown', () => selectAC(c.name_en));
        acList.appendChild(item);
    });

    acList.classList.add('open');
});

guessInput.addEventListener('keydown', e => {
    const items = acList.querySelectorAll('.autocomplete-item');
    if (e.key === 'ArrowDown') {
        acIndex = Math.min(acIndex + 1, items.length - 1);
        updateACHighlight(items);
        e.preventDefault();
    } else if (e.key === 'ArrowUp') {
        acIndex = Math.max(acIndex - 1, 0);
        updateACHighlight(items);
        e.preventDefault();
    } else if (e.key === 'Enter') {
        if (acIndex >= 0 && items[acIndex]) {
            selectAC(items[acIndex].querySelector('span').textContent);
        } else {
            submitGuess();
        }
        e.preventDefault();
    } else if (e.key === 'Escape') {
        closeAutocomplete();
    }
});

function updateACHighlight(items) {
    items.forEach((el, i) => el.classList.toggle('selected', i === acIndex));
}

function selectAC(name) {
    selectedGuess = name;
    guessInput.value = name;
    closeAutocomplete();
}

function closeAutocomplete() {
    acList.classList.remove('open');
    acList.innerHTML = '';
    acIndex = -1;
}

document.addEventListener('click', e => {
    if (!e.target.closest('.guess-wrap')) closeAutocomplete();
});

// ─── STATS ────────────────────────────────────────────────────────────────────

const STATS_KEY = 'umaguessr_stats';

function loadStats() {
    try {
        const raw = localStorage.getItem(STATS_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) { }
    return { played: 0, wins: 0, streak: 0, maxStreak: 0, dist: [0, 0, 0, 0, 0, 0, 0] };
}

function saveStats(s) {
    localStorage.setItem(STATS_KEY, JSON.stringify(s));
}

function recordResult(won, attemptNum) {
    const s = loadStats();
    s.played++;
    if (won) {
        s.wins++;
        s.streak++;
        if (s.streak > s.maxStreak) s.maxStreak = s.streak;
        s.dist[attemptNum] = (s.dist[attemptNum] || 0) + 1;
    } else {
        s.streak = 0;
        s.losses = (s.losses || 0) + 1;
    }
    saveStats(s);
}


function openStats() {
    renderStats();
    document.getElementById('stats-modal').classList.add('open');
}

function closeStats() {
    document.getElementById('stats-modal').classList.remove('open');
}

function handleBackdropClick(e) {
    if (e.target === document.getElementById('stats-modal')) closeStats();
}

function openHelp() {
    document.getElementById('howto-modal').classList.add('open');
}

function closeHelp() {
    document.getElementById('howto-modal').classList.remove('open');
}

function handleHelpBackdropClick(e) {
    if (e.target === document.getElementById('howto-modal')) closeHelp();
}

function openUpdates() {
    document.getElementById('updates-modal').classList.add('open');
}

function closeUpdates() {
    document.getElementById('updates-modal').classList.remove('open');
}

function handleUpdateBackdropClick(e) {
    if (e.target === document.getElementById('updates-modal')) closeUpdates();
}

function goHome() {
    document.getElementById('game-screen').style.display = 'none';
    document.getElementById('result-screen').style.display = 'none';
    document.getElementById('start-screen').style.display = 'block';
    closeAutocomplete();
    checkDailyStatus();
}

// ─── THEME ───────────────────────────────────────────────────────────────────

function initTheme() {
    const saved = localStorage.getItem('umaguessr_theme');
    setTheme(saved || 'light');
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'light' : 'dark');
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('umaguessr_theme', theme);
    document.getElementById('theme-btn').textContent = theme === 'dark' ? '🌕' : '🌑';
    const lightGif = document.getElementById('home-gif-light');
    const darkGif = document.getElementById('home-gif-dark');
    if (lightGif && darkGif) {
        lightGif.style.display = theme === 'dark' ? 'none' : 'block';
        darkGif.style.display = theme === 'dark' ? 'block' : 'none';
    }
}

function renderStats() {
    const s = loadStats();
    const winPct = s.played === 0 ? 0 : Math.round((s.wins / s.played) * 100);
    const lossVal = s.losses || 0;
    const maxVal = Math.max(...[1,2,3,4,5,6].map(i => s.dist[i] || 0), lossVal, 1);
    const lossPct = Math.round((lossVal / maxVal) * 100);
    const el = document.getElementById('stats-content');

    const distRows = [1, 2, 3, 4, 5, 6].map(i => {
        const val = s.dist[i] || 0;
        const pct = Math.round((val / maxVal) * 100);
        const isLast = lastWonAttempt === i;
        return `<div class="bar-row">
      <div class="bar-label">${i}</div>
      <div class="bar-track">
        <div class="bar-fill ${isLast ? 'highlight' : ''}" style="width:${Math.max(pct, 2)}%">
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

    const countdownHTML = `
    <div class="stats-countdown">
      <div class="stats-countdown-label">Next daily</div>
      <div class="countdown-val stats-countdown-val">--:--:--</div>
    </div>`;

    el.innerHTML = `
    <div class="stats-grid">
      <div class="stat-box"><div class="num">${s.played}</div><div class="lbl">Played</div></div>
      <div class="stat-box"><div class="num">${winPct}%</div><div class="lbl">Win Rate</div></div>
      <div class="stat-box"><div class="num">${s.streak}</div><div class="lbl">Current Streak</div></div>
      <div class="stat-box"><div class="num">${s.maxStreak}</div><div class="lbl">Max Streak</div></div>
    </div>
    <div class="dist-title">Guess Distribution <span style="font-weight:400;color:var(--text-muted)">(daily only)</span></div>
    ${s.played === 0 ? '<div class="no-stats">No daily games played yet!</div>' : distRows + lossRow}
    ${countdownHTML}
  `;
}

let lastWonAttempt = -1;

loadData();
