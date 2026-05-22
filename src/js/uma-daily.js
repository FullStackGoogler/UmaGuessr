import { getTodayKeyEST, seededShuffle, normalize, buildEmojiRow } from '../shared/script.js';
import { initTopbar } from '../shared/topbar.js';
import { initFooter } from '../shared/footer.js';

// ─── STATE ──────────────────────────────────────────────────

let allChars = [];
let allImages = [];
let currentChar = null;
let currentImages = null;
let attempt = 0;
let selectedGuess = '';
let wrongGuesses = new Set();
let gameMode = null; // 'daily' | 'infinite'
let umaDailyComplete = false;
let lastWonAttempt = -1;

const MAX_ATTEMPTS = 6;
const UMA_DAILY_KEY = 'umaguessr_uma_daily';
const UMA_STATS_KEY = 'umaguessr_uma_stats';

// ─── DATA LOADING ──────────────────────────────────────────────────

async function loadData() {
    try {
        const [infoRes, imgRes] = await Promise.all([
            fetch('/assets/data/characterInfos.json'),
            fetch('/assets/data/characterImages.json')
        ]);
        allChars = await infoRes.json();
        allImages = await imgRes.json();

        document.getElementById('loading').style.display = 'none';
        checkUmaDailyStatus();
        autoStart();
    } catch (e) {
        console.log(e);
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent = 'Could not load character data.';
    }
}

// ─── AUTO START ──────────────────────────────────────────────────

function autoStart() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'infinite') {
        startInfinite();
    } else if (umaDailyComplete) {
        showCompletedUmaDaily();
    } else {
        startUmaDaily();
    }
}

// ─── UMA DAILY LOGIC ──────────────────────────────────────────────────

function getDailyUma() {
    const key = getTodayKeyEST();
    const startDate = new Date('2026-05-05T12:00:00Z');
    const today = new Date(key + 'T12:00:00Z');
    const daysSinceStart = Math.floor((today - startDate) / 86400000);
    const cycle = Math.floor(daysSinceStart / allChars.length);
    const dayInCycle = daysSinceStart % allChars.length;
    const shuffled = seededShuffle(allChars, cycle + 1);
    return shuffled[dayInCycle];
}

function checkUmaDailyStatus() {
    const key = getTodayKeyEST();
    const saved = getUmaDailySave();
    umaDailyComplete = !!(saved && saved.dateKey === key);
}

function getUmaDailySave() {
    try {
        const raw = localStorage.getItem(UMA_DAILY_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

function saveUmaDailyResult(won, attemptNum) {
    const key = getTodayKeyEST();
    localStorage.setItem(UMA_DAILY_KEY, JSON.stringify({
        dateKey: key,
        won,
        attemptNum,
        charName: currentChar.name_en
    }));
}

// ─── GAME START ──────────────────────────────────────────────────

function startUmaDaily() {
    gameMode = 'daily';
    currentChar = getDailyUma();
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
    wrongGuesses = new Set();
    const imgEntry = allImages.find(x => x.web_id === currentChar.id);
    currentImages = imgEntry ? imgEntry.images : null;

    document.getElementById('result-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
    document.getElementById('clues-container').innerHTML = '';
    document.getElementById('wrong-guesses').innerHTML = '';
    document.getElementById('guess-input').value = '';
    document.getElementById('guess-feedback').textContent = '';
    document.getElementById('guess-section').style.display = 'block';

    const badge = document.getElementById('mode-badge');
    badge.textContent = gameMode === 'daily' ? '📅 Uma Musume Daily' : '∞ Infinite Mode';
    badge.className = 'mode-badge' + (gameMode === 'infinite' ? ' infinite' : '');
    badge.style.display = 'inline-flex';

    buildProgressDots();
    renderClue(0);
}

function showCompletedUmaDaily() {
    const saved = getUmaDailySave();
    gameMode = 'daily';
    currentChar = getDailyUma();
    const imgEntry = allImages.find(x => x.web_id === currentChar.id);
    currentImages = imgEntry ? imgEntry.images : null;
    attempt = saved.won ? saved.attemptNum - 1 : MAX_ATTEMPTS - 1;
    lastWonAttempt = saved.won ? saved.attemptNum : -1;
    showResult(saved.won, true);
}

// ─── GAME FLOW ──────────────────────────────────────────────────

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
        
        if (racewearImg) {
            card.innerHTML = `<div class="clue-label">Blurred Racewear</div>
                <div class="blurred-img-wrap">
                    <canvas id="racewear-canvas"></canvas>
                </div>`;
            container.appendChild(card);

            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                const canvas = document.getElementById('racewear-canvas');
                canvas.width = img.naturalWidth;
                canvas.height = img.naturalHeight;
                const ctx = canvas.getContext('2d');
                ctx.filter = 'blur(18px) brightness(0.85)';
                ctx.drawImage(img, 0, 0);
            };
            img.src = racewearImg;
        } else {
            card.innerHTML = `<div class="clue-label">Blurred Racewear</div>
                <div class="clue-content">No image available.</div>`;
            container.appendChild(card);
        }
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
    const feedback = document.getElementById('guess-feedback');
    if (!guess) return;

    const normalizedGuess = normalize(guess);

    // Duplicate guess check
    if (wrongGuesses.has(normalizedGuess)) {
        feedback.textContent = 'You already guessed that!';
        return;
    }

    feedback.textContent = '';
    const correctName = normalize(currentChar.name_en);

    if (normalizedGuess === correctName) {
        markDot(attempt, 'correct');
        showResult(true);
    } else {
        markDot(attempt, 'used');
        wrongGuesses.add(normalizedGuess);
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
    document.getElementById('guess-feedback').textContent = '';
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

    if (!isReplay && gameMode === 'daily') {
        recordUmaResult(correct, correct ? attempt + 1 : 6);
        saveUmaDailyResult(correct, correct ? attempt + 1 : 6);
        umaDailyComplete = true;
    }

    document.getElementById('game-screen').style.display = 'none';
    document.getElementById('guess-section').style.display = 'none';
    document.getElementById('result-screen').style.display = 'block';

    const c = currentChar;
    const racewearImg = getRacewearImage();
    const bannerClass = correct ? 'correct' : 'wrong';
    const bannerTitle = correct ? `Correct! 🎉` : `The answer was...`;
    const bannerSub = correct ? `You got it on attempt ${attempt + 1}!` : `Better luck next time!`;
    const modeTag = gameMode === 'daily'
        ? `<div class="result-mode-tag">📅 Uma Musume Daily</div>`
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

    const supportSave = getSupportDailySave();
    const supportDoneToday = supportSave && supportSave.dateKey === getTodayKeyEST();

    const dailyFooterHTML = gameMode === 'daily' ? `
        <div class="result-countdown">
            <div class="result-countdown-label">Next daily in</div>
            <div class="countdown-val result-countdown-val">--:--:--</div>
        </div>
        <div class="result-actions">
            <button id="share-btn" class="btn-share">Share</button>
            ${!supportDoneToday
                ? `<button id="play-support-btn" class="btn-other-daily">🃏 Support Card Daily</button>`
                : ''}
            <button id="play-infinite-btn" class="btn-other-daily">∞ Infinite Mode</button>
        </div>` : `
        <div class="result-actions">
            <button id="play-infinite-btn" class="btn-other-daily">∞ Play Again</button>
        </div>`;

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
        ${dailyFooterHTML}
    `;

    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) shareBtn.addEventListener('click', shareResult);

    const playSupportBtn = document.getElementById('play-support-btn');
    if (playSupportBtn) playSupportBtn.addEventListener('click', () => {
        window.location.href = '/support.html';
    });

    const playInfiniteBtn = document.getElementById('play-infinite-btn');
    if (playInfiniteBtn) playInfiniteBtn.addEventListener('click', startInfinite);
}

function getSupportDailySave() {
    try {
        const raw = localStorage.getItem('umaguessr_support_daily');
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

// ─── SHARE ──────────────────────────────────────────────────

function generateShareText() {
    const date = getTodayKeyEST().split('-').reverse().join('/').replace(/(\d+)\/(\d+)\/(\d+)/, '$2/$1/$3');
    const umaRow = buildEmojiRow(lastWonAttempt, MAX_ATTEMPTS);

    const supportSave = getSupportDailySave();
    const supportDoneToday = supportSave && supportSave.dateKey === getTodayKeyEST();
    let supportLine = '';
    if (supportDoneToday) {
        const supportRow = buildEmojiRow(supportSave.won ? supportSave.attemptNum : -1, MAX_ATTEMPTS);
        supportLine = `\n🃏 ${supportRow}`;
    }

    return `UmaGuessr ${date}\n🐎 ${umaRow}${supportLine}\n\nhttps://www.umaguessr.com`;
}

async function shareResult() {
    const text = generateShareText();
    try {
        await navigator.clipboard.writeText(text);
        const btn = document.getElementById('share-btn');
        btn.textContent = 'Copied!';
        setTimeout(() => btn.textContent = 'Share', 2000);
    } catch (e) {
        prompt('Copy this to share:', text);
    }
}

// ─── STATS ──────────────────────────────────────────────────

function loadUmaStats() {
    try {
        const raw = localStorage.getItem(UMA_STATS_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { played: 0, wins: 0, streak: 0, maxStreak: 0, dist: [0, 0, 0, 0, 0, 0, 0] };
}

function saveUmaStats(s) {
    localStorage.setItem(UMA_STATS_KEY, JSON.stringify(s));
}

function recordUmaResult(won, attemptNum) {
    const s = loadUmaStats();
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
    saveUmaStats(s);
}

// ─── AUTOCOMPLETE ──────────────────────────────────────────────────

const guessInput = document.getElementById('guess-input');
const acList = document.getElementById('autocomplete-list');
let acIndex = -1;

guessInput.addEventListener('input', () => {
    selectedGuess = '';
    const val = normalize(guessInput.value);
    document.getElementById('guess-feedback').textContent = '';
    if (!val) { closeAutocomplete(); return; }

    const matches = allChars.filter(c =>
        c.name_en && normalize(c.name_en).includes(val) && !wrongGuesses.has(normalize(c.name_en))
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

// ─── INIT ──────────────────────────────────────────────────

async function init() {
    await initTopbar({
        subtitle: 'Guess the Uma Musume from the clues',
        showStats: true,
        showCountdown: true,
        onDayRollover: () => { checkUmaDailyStatus(); },
    });

    initFooter();

    document.getElementById('guess-btn').addEventListener('click', submitGuess);
    document.getElementById('skip-btn').addEventListener('click', skipAttempt);

    await loadData();
}

init();
