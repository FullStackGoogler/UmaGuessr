import {
    getTodayKeyEST, startCountdownTick,
    seededShuffle, normalize, buildEmojiRow
} from '../shared/script.js';
import { initTopbar } from '../shared/topbar.js';
import { initFooter } from '../shared/footer.js';

// ─── STATE ──────────────────────────────────────────────────

let allCards = [];
let currentCard = null;
let attempt = 0;
let selectedGuess = '';
let gameMode = null; // 'daily' | 'infinite'
let supportDailyComplete = false;
let lastWonAttempt = -1;

const MAX_ATTEMPTS = 6;
const SUPPORT_DAILY_KEY = 'umaguessr_support_daily';
const SUPPORT_STATS_KEY = 'umaguessr_support_stats';
const SUPPORT_START_DATE = '2026-05-20T12:00:00Z';

// ─── DATA LOADING ──────────────────────────────────────────────────

async function loadData() {
    try {
        // Uncomment when data is ready:
        // const res = await fetch('/assets/data/supportCards.json');
        // allCards = await res.json();
        allCards = [];

        document.getElementById('loading').style.display = 'none';
        checkSupportDailyStatus();
        autoStart();
    } catch (e) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent = 'Could not load support card data.';
    }
}

// ─── AUTO START ──────────────────────────────────────────────────

function autoStart() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'infinite') {
        startInfinite();
    } else if (supportDailyComplete) {
        showCompletedSupportDaily();
    } else {
        startSupportDaily();
    }
}

// ─── SUPPORT DAILY LOGIC ──────────────────────────────────────────────────

function getDailySupportCard() {
    const key = getTodayKeyEST();
    const startDate = new Date(SUPPORT_START_DATE);
    const today = new Date(key + 'T12:00:00Z');
    const daysSinceStart = Math.floor((today - startDate) / 86400000);
    const cycle = Math.floor(daysSinceStart / allCards.length);
    const dayInCycle = daysSinceStart % allCards.length;
    const shuffled = seededShuffle(allCards, cycle + 1);
    return shuffled[dayInCycle];
}

function checkSupportDailyStatus() {
    const key = getTodayKeyEST();
    const saved = getSupportDailySave();
    supportDailyComplete = !!(saved && saved.dateKey === key);
}

function getSupportDailySave() {
    try {
        const raw = localStorage.getItem(SUPPORT_DAILY_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

function saveSupportDailyResult(won, attemptNum) {
    const key = getTodayKeyEST();
    localStorage.setItem(SUPPORT_DAILY_KEY, JSON.stringify({
        dateKey: key,
        won,
        attemptNum,
        cardName: currentCard?.name || 'Unknown'
    }));
}

// ─── GAME START ──────────────────────────────────────────────────

function getPlaceholderCard() {
    return { id: 30001, name: 'Placeholder Card', image: 'https://assets.umaguessr.com/images/30001.png' };
}

function startSupportDaily() {
    gameMode = 'daily';
    currentCard = allCards.length > 0 ? getDailySupportCard() : getPlaceholderCard();
    beginGame();
}

function startInfinite() {
    gameMode = 'infinite';
    currentCard = allCards.length > 0
        ? allCards[Math.floor(Math.random() * allCards.length)]
        : getPlaceholderCard();
    beginGame();
}

function beginGame() {
    attempt = 0;
    selectedGuess = '';

    document.getElementById('result-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
    document.getElementById('wrong-guesses').innerHTML = '';
    document.getElementById('guess-input').value = '';
    document.getElementById('guess-section').style.display = 'block';

    const cardImg = document.getElementById('card-image');
    cardImg.src = currentCard.image || `https://assets.umaguessr.com/images/${currentCard.id}.png`;

    const badge = document.getElementById('mode-badge');
    badge.textContent = gameMode === 'daily' ? '🃏 Support Card Daily' : '∞ Infinite Mode';
    badge.className = 'mode-badge support-badge' + (gameMode === 'infinite' ? ' infinite' : '');
    badge.style.display = 'inline-flex';

    buildProgressDots();
}

function showCompletedSupportDaily() {
    const saved = getSupportDailySave();
    gameMode = 'daily';
    currentCard = allCards.length > 0 ? getDailySupportCard() : getPlaceholderCard();
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

function submitGuess() {
    const input = document.getElementById('guess-input').value.trim();
    const guess = selectedGuess || input;
    if (!guess) return;

    const normalizedGuess = normalize(guess);
    const correctName = normalize(currentCard.name || '');

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
        if (attempt >= MAX_ATTEMPTS) showResult(false);
    }
}

function skipAttempt() {
    markDot(attempt, 'used');
    attempt++;
    document.getElementById('guess-input').value = '';
    selectedGuess = '';
    closeAutocomplete();
    if (attempt >= MAX_ATTEMPTS) showResult(false);
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
        recordSupportResult(correct, correct ? attempt + 1 : 6);
        saveSupportDailyResult(correct, correct ? attempt + 1 : 6);
        supportDailyComplete = true;
    }

    document.getElementById('game-screen').style.display = 'none';
    document.getElementById('guess-section').style.display = 'none';
    document.getElementById('result-screen').style.display = 'block';

    const bannerClass = correct ? 'correct' : 'wrong';
    const bannerTitle = correct ? `Correct! 🎉` : `The answer was...`;
    const bannerSub = correct ? `You got it on attempt ${attempt + 1}!` : `Better luck next time!`;
    const modeTag = gameMode === 'daily'
        ? `<div class="result-mode-tag support-tag">🃏 Support Card Daily</div>`
        : `<div class="result-mode-tag infinite">∞ Infinite Mode</div>`;

    const umaSave = getUmaDailySave();
    const umaDoneToday = umaSave && umaSave.dateKey === getTodayKeyEST();

    const dailyFooterHTML = gameMode === 'daily' ? `
        <div class="result-countdown">
            <div class="result-countdown-label">Next daily in</div>
            <div class="countdown-val result-countdown-val">--:--:--</div>
        </div>
        <div class="result-actions">
            <button id="share-btn" class="btn-share">Share</button>
            ${!umaDoneToday
                ? `<button id="play-uma-btn" class="btn-other-daily">🐎 Uma Musume Daily</button>`
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
        <div class="result-card-img-wrap">
            <img src="${currentCard.image || `https://assets.umaguessr.com/images/${currentCard.id}.png`}"
                 alt="${currentCard.name}" class="reveal-card-img" />
        </div>
        <div class="result-card-name">
            <h3>${currentCard.name || '—'}</h3>
        </div>
        ${dailyFooterHTML}
    `;

    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) shareBtn.addEventListener('click', shareResult);

    const playUmaBtn = document.getElementById('play-uma-btn');
    if (playUmaBtn) playUmaBtn.addEventListener('click', () => {
        window.location.href = '/uma-daily.html';
    });

    const playInfiniteBtn = document.getElementById('play-infinite-btn');
    if (playInfiniteBtn) playInfiniteBtn.addEventListener('click', startInfinite);
}

function getUmaDailySave() {
    try {
        const raw = localStorage.getItem('umaguessr_uma_daily');
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

// ─── SHARE ──────────────────────────────────────────────────

function generateShareText() {
    const date = getTodayKeyEST().split('-').reverse().join('/').replace(/(\d+)\/(\d+)\/(\d+)/, '$2/$1/$3');
    const supportRow = buildEmojiRow(lastWonAttempt, MAX_ATTEMPTS);

    const umaSave = getUmaDailySave();
    const umaDoneToday = umaSave && umaSave.dateKey === getTodayKeyEST();
    let umaLine = '';
    if (umaDoneToday) {
        const umaRow = buildEmojiRow(umaSave.won ? umaSave.attemptNum : -1, MAX_ATTEMPTS);
        umaLine = `\n🐎 ${umaRow}`;
    }

    return `UmaGuessr ${date}${umaLine}\n🃏 ${supportRow}\n\nhttps://www.umaguessr.com`;
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

function loadSupportStats() {
    try {
        const raw = localStorage.getItem(SUPPORT_STATS_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { played: 0, wins: 0, streak: 0, maxStreak: 0, dist: [0, 0, 0, 0, 0, 0, 0] };
}

function saveSupportStats(s) {
    localStorage.setItem(SUPPORT_STATS_KEY, JSON.stringify(s));
}

function recordSupportResult(won, attemptNum) {
    const s = loadSupportStats();
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
    saveSupportStats(s);
}

// ─── AUTOCOMPLETE ──────────────────────────────────────────────────

const guessInput = document.getElementById('guess-input');
const acList = document.getElementById('autocomplete-list');
let acIndex = -1;

guessInput.addEventListener('input', () => {
    selectedGuess = '';
    const val = normalize(guessInput.value);
    if (!val || allCards.length === 0) { closeAutocomplete(); return; }

    const matches = allCards.filter(c =>
        c.name && normalize(c.name).includes(val)
    ).slice(0, 8);

    if (!matches.length) { closeAutocomplete(); return; }

    acList.innerHTML = '';
    acIndex = -1;
    matches.forEach((c) => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.innerHTML = `<span>${c.name}</span>`;
        item.addEventListener('mousedown', () => selectAC(c.name));
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
        subtitle: 'Guess the support card from the image',
        showStats: true,
        showCountdown: true,
        onDayRollover: () => checkSupportDailyStatus(),
    });

    initFooter();

    document.getElementById('guess-btn').addEventListener('click', submitGuess);
    document.getElementById('skip-btn').addEventListener('click', skipAttempt);

    await loadData();
}

init();
