import { getTodayKeyEST, seededShuffle, normalize, buildEmojiRow } from '../shared/script.js';
import { initTopbar } from '../shared/topbar.js';
import { initFooter } from '../shared/footer.js';

// ─── STATE ────────────────────────────────────────────────────────────────────

let allSkills = [];
let currentSkill = null;
let attempt = 0;
let selectedGuess = '';
let wrongGuesses = new Set();
let gameMode = null; // 'daily' | 'infinite'
let skillDailyComplete = false;
let lastWonAttempt = -1;
let revealOrder = []; // seeded order of letter indices to reveal

const MAX_ATTEMPTS = 6;
const SKILL_DAILY_KEY = 'umaguessr_skill_daily';
const SKILL_STATS_KEY = 'umaguessr_skill_stats';
const SKILL_START_DATE = '2026-06-24T12:00:00Z';
const SKILL_CYCLE_LENGTH = 557; //TODO: Better implementation, will require a change in the algorithm

// Percentage of letters to reveal after each failed guess (index = attempt number)
const REVEAL_PERCENTAGES = [0, 0.16, 0.34, 0.51, 0.67, 0.85];

// ─── DATA LOADING ─────────────────────────────────────────────────────────────

async function loadData() {
    try {
        const res = await fetch('/assets/data/skills.json');
        const raw = await res.json();
        allSkills = raw.filter(s =>
            s.grade_value !== 0 &&
            s.skill_category !== 101 &&
            s.grade_value !== -500
        );

        document.getElementById('loading').style.display = 'none';
        checkSkillDailyStatus();
        autoStart();
    } catch (e) {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('error').style.display = 'block';
        document.getElementById('error').textContent = 'Could not load skill data.';
    }
}

// ─── AUTO START ───────────────────────────────────────────────────────────────

function autoStart() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('mode') === 'infinite') {
        startInfinite();
    } else if (skillDailyComplete) {
        showCompletedSkillDaily();
    } else {
        startSkillDaily();
    }
}

// ─── SKILL DAILY LOGIC ────────────────────────────────────────────────────────

function getDailySkill() {
    const key = getTodayKeyEST();
    const days = Math.floor((new Date(key + 'T12:00:00Z') - new Date(SKILL_START_DATE)) / 86400000);
    const shuffled = seededShuffle(allSkills.slice(0, SKILL_CYCLE_LENGTH), Math.floor(days / SKILL_CYCLE_LENGTH) + 1);
    return shuffled[days % SKILL_CYCLE_LENGTH];
}

function checkSkillDailyStatus() {
    const key = getTodayKeyEST();
    const saved = getSkillDailySave();
    skillDailyComplete = !!(saved && saved.dateKey === key);
}

function getSkillDailySave() {
    try {
        const raw = localStorage.getItem(SKILL_DAILY_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

function saveSkillDailyResult(won, attemptNum) {
    const key = getTodayKeyEST();
    localStorage.setItem(SKILL_DAILY_KEY, JSON.stringify({
        dateKey: key,
        won,
        attemptNum,
        skillName: currentSkill?.skill_name || 'Unknown'
    }));
}

// ─── LETTER REVEAL ────────────────────────────────────────────────────────────

// Returns array of character indices that are letters (not spaces/punctuation)
function getLetterIndices(name) {
    const indices = [];
    for (let i = 0; i < name.length; i++) {
        if (/[a-zA-Z]/.test(name[i])) indices.push(i);
    }
    return indices;
}

// Seeded shuffle of letter indices using skill_id as seed — deterministic per skill
function getRevealOrder(skill) {
    const indices = getLetterIndices(skill.skill_name);
    let s = skill.skill_id;
    const list = [...indices];
    for (let i = list.length - 1; i > 0; i--) {
        s = Math.imul(s ^ (s >>> 15), 0x735a2d97);
        s ^= s >>> 16;
        const j = Math.abs(s) % (i + 1);
        [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
}

// Build the masked name string for a given attempt
function getMaskedName(skill, attemptNum) {
    const name = skill.skill_name;
    const letterIndices = getLetterIndices(name);
    const totalLetters = letterIndices.length;
    const revealCount = Math.floor(REVEAL_PERCENTAGES[attemptNum] * totalLetters);
    const revealedIndices = new Set(revealOrder.slice(0, revealCount));

    return name.split('').map((char, i) => {
        if (/[a-zA-Z]/.test(char)) {
            return revealedIndices.has(i) ? char : '_';
        }
        return char; // spaces, punctuation, numbers, symbols always shown
    }).join('');
}

// ─── GAME START ───────────────────────────────────────────────────────────────

function startSkillDaily() {
    gameMode = 'daily';
    currentSkill = getDailySkill();
    beginGame();
}

function startInfinite() {
    gameMode = 'infinite';
    currentSkill = allSkills[Math.floor(Math.random() * allSkills.length)];
    beginGame();
}

function beginGame() {
    attempt = 0;
    selectedGuess = '';
    wrongGuesses = new Set();
    revealOrder = getRevealOrder(currentSkill);

    document.getElementById('result-screen').style.display = 'none';
    document.getElementById('game-screen').style.display = 'block';
    document.getElementById('wrong-guesses').innerHTML = '';
    document.getElementById('guess-input').value = '';
    document.getElementById('guess-feedback').textContent = '';
    document.getElementById('guess-section').style.display = 'block';

    const badge = document.getElementById('mode-badge');
    badge.textContent = gameMode === 'daily' ? '🎯 Skill Daily' : '∞ Infinite Mode';
    badge.className = 'mode-badge skill-badge' + (gameMode === 'infinite' ? ' infinite' : '');
    badge.style.display = 'inline-flex';

    buildProgressDots();
    renderSkillDisplay();
    renderHints();
}

function showCompletedSkillDaily() {
    const saved = getSkillDailySave();
    gameMode = 'daily';
    currentSkill = getDailySkill();
    revealOrder = getRevealOrder(currentSkill);
    attempt = saved.won ? saved.attemptNum - 1 : MAX_ATTEMPTS - 1;
    lastWonAttempt = saved.won ? saved.attemptNum : -1;
    showResult(saved.won, true);
}

// ─── SKILL DISPLAY ────────────────────────────────────────────────────────────

function renderSkillDisplay() {
    document.getElementById('skill-name-display').textContent = getMaskedName(currentSkill, attempt);
}

function renderHints() {
    const iconWrap = document.getElementById('skill-icon-wrap');
    const descWrap = document.getElementById('skill-desc-wrap');

    // Icon revealed after 2nd failed guess (attempt >= 2)
    if (attempt >= 2) {
        iconWrap.innerHTML = `
            <div class="clue-label">Skill Icon</div>
            <img src="https://assets.umaguessr.com/skill-icons/${currentSkill.icon_id}.png"
                 alt="${currentSkill.icon_id}" class="skill-icon-img" />
        `;
    } else {
        iconWrap.innerHTML = `
            <div class="clue-label">Skill Icon</div>
            <div class="clue-content hint-locked">? — unlocks in ${2 - attempt} guess${2 - attempt === 1 ? '' : 'es'}</div>
        `;
    }

    // Description revealed after 4th failed guess (attempt >= 4)
    if (attempt >= 4) {
        descWrap.innerHTML = `
            <div class="clue-label">Description</div>
            <div class="clue-content">${currentSkill.description}</div>
        `;
    } else {
        descWrap.innerHTML = `
            <div class="clue-label">Description</div>
            <div class="clue-content hint-locked">? — unlocks in ${4 - attempt} guess${4 - attempt === 1 ? '' : 'es'}</div>
        `;
    }
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

function submitGuess() {
    const input = document.getElementById('guess-input').value.trim();
    const guess = selectedGuess || input;
    const feedback = document.getElementById('guess-feedback');
    if (!guess) return;

    const normalizedGuess = normalize(guess);

    if (wrongGuesses.has(normalizedGuess)) {
        feedback.textContent = 'You already guessed that!';
        return;
    }

    feedback.textContent = '';
    const correctName = normalize(currentSkill.skill_name);

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
            renderSkillDisplay();
            renderHints();
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
        renderSkillDisplay();
        renderHints();
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
        recordSkillResult(correct, correct ? attempt + 1 : 6);
        saveSkillDailyResult(correct, correct ? attempt + 1 : 6);
        skillDailyComplete = true;
    }

    document.getElementById('game-screen').style.display = 'none';
    document.getElementById('guess-section').style.display = 'none';
    document.getElementById('result-screen').style.display = 'block';

    const bannerClass = correct ? 'correct' : 'wrong';
    const bannerTitle = correct ? `Correct! 🎉` : `The answer was...`;
    const bannerSub = correct ? `You got it on attempt ${attempt + 1}!` : `Better luck next time!`;
    const modeTag = gameMode === 'daily'
        ? `<div class="result-mode-tag skill-tag">🎯 Skill Daily</div>`
        : `<div class="result-mode-tag infinite">∞ Infinite Mode</div>`;

    const umaSave = getUmaDailySave();
    const supportSave = getSupportDailySave();
    const umaDoneToday = umaSave && umaSave.dateKey === getTodayKeyEST();
    const supportDoneToday = supportSave && supportSave.dateKey === getTodayKeyEST();

    const dailyFooterHTML = gameMode === 'daily' ? `
        <div class="result-countdown">
            <div class="result-countdown-label">Next daily in</div>
            <div class="countdown-val result-countdown-val">--:--:--</div>
        </div>
        <div class="result-actions">
            <button id="share-btn" class="btn-share">Share</button>
            ${!umaDoneToday ? `<button id="play-uma-btn" class="btn-other-daily">🐎 Uma Musume Daily</button>` : ''}
            ${!supportDoneToday ? `<button id="play-support-btn" class="btn-other-daily">🃏 Support Card Daily</button>` : ''}
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
        <div class="result-skill">
            <img src="https://assets.umaguessr.com/skill-icons/${currentSkill.icon_id}.png"
                 alt="${currentSkill.skill_name}" class="result-skill-icon" />
            <div class="result-skill-info">
                <h3>${currentSkill.skill_name}</h3>
                <p>${currentSkill.description}</p>
            </div>
        </div>
        ${dailyFooterHTML}
    `;

    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) shareBtn.addEventListener('click', shareResult);

    const playUmaBtn = document.getElementById('play-uma-btn');
    if (playUmaBtn) playUmaBtn.addEventListener('click', () => { window.location.href = '/uma.html'; });

    const playSupportBtn = document.getElementById('play-support-btn');
    if (playSupportBtn) playSupportBtn.addEventListener('click', () => { window.location.href = '/support.html'; });

    const playInfiniteBtn = document.getElementById('play-infinite-btn');
    if (playInfiniteBtn) playInfiniteBtn.addEventListener('click', () => { window.location.href = '/skill.html?mode=infinite'; });
}

function getUmaDailySave() {
    try { return JSON.parse(localStorage.getItem('umaguessr_uma_daily')); } catch (e) { return null; }
}

function getSupportDailySave() {
    try { return JSON.parse(localStorage.getItem('umaguessr_support_daily')); } catch (e) { return null; }
}

// ─── SHARE ────────────────────────────────────────────────────────────────────

function generateShareText() {
    const date = getTodayKeyEST().split('-').reverse().join('/').replace(/(\d+)\/(\d+)\/(\d+)/, '$2/$1/$3');
    let skillLine = `\n🎯 ${buildEmojiRow(lastWonAttempt, MAX_ATTEMPTS)}`;

    const umaSave = getUmaDailySave();
    const supportSave = getSupportDailySave();
    const umaDoneToday = umaSave && umaSave.dateKey === getTodayKeyEST();
    const supportDoneToday = supportSave && supportSave.dateKey === getTodayKeyEST();

    let umaLine = '';
    let supportLine = '';

    if (umaDoneToday) {
        umaLine = `\n🐎 ${buildEmojiRow(umaSave.won ? umaSave.attemptNum : -1, MAX_ATTEMPTS)}`;
    }
    if (supportDoneToday) {
        supportLine = `\n🃏 ${buildEmojiRow(supportSave.won ? supportSave.attemptNum : -1, MAX_ATTEMPTS)}`;
    }

    return `UmaGuessr ${date}${umaLine}${supportLine}${skillLine}\n\nhttps://www.umaguessr.com`;
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

// ─── STATS ────────────────────────────────────────────────────────────────────

function loadSkillStats() {
    try {
        const raw = localStorage.getItem(SKILL_STATS_KEY);
        if (raw) return JSON.parse(raw);
    } catch (e) {}
    return { played: 0, wins: 0, streak: 0, maxStreak: 0, dist: [0, 0, 0, 0, 0, 0, 0] };
}

function saveSkillStats(s) {
    localStorage.setItem(SKILL_STATS_KEY, JSON.stringify(s));
}

function recordSkillResult(won, attemptNum) {
    const s = loadSkillStats();
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
    saveSkillStats(s);
}

// ─── AUTOCOMPLETE ─────────────────────────────────────────────────────────────

const guessInput = document.getElementById('guess-input');
const acList = document.getElementById('autocomplete-list');
let acIndex = -1;

guessInput.addEventListener('input', () => {
    selectedGuess = '';
    const val = normalize(guessInput.value);
    document.getElementById('guess-feedback').textContent = '';
    if (!val || allSkills.length === 0) { closeAutocomplete(); return; }

    const matches = allSkills
        .filter(s =>
            s.skill_name &&
            normalize(s.skill_name).includes(val) &&
            !wrongGuesses.has(normalize(s.skill_name))
        )
        .slice(0, 8);

    if (!matches.length) { closeAutocomplete(); return; }

    acList.innerHTML = '';
    acIndex = -1;
    matches.forEach(s => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item';
        item.innerHTML = `<span>${s.skill_name}</span>`;
        item.addEventListener('mousedown', () => selectAC(s.skill_name));
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

// ─── INIT ─────────────────────────────────────────────────────────────────────

async function init() {
    await initTopbar({
        subtitle: 'Guess the skill from the name',
        showStats: true,
        showCountdown: true,
        onDayRollover: () => checkSkillDailyStatus(),
    });

    initFooter();

    document.getElementById('guess-btn').addEventListener('click', submitGuess);
    document.getElementById('skip-btn').addEventListener('click', skipAttempt);

    await loadData();
}

init();
