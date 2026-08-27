/*
 * BetterIG front-end prototype
 * ----------------------------
 * Supabase is isolated behind backend.js. localStorage is used only for the
 * device's mute preference; identity, likes, scores, and games are shared.
 */

const REELS = [
  { id: "meme-01", src: "assets/memes/meme-01.mp4", likes: 24800 },
  { id: "meme-02", src: "assets/memes/meme-02.mp4", likes: 12600 },
  { id: "meme-03", src: "assets/memes/meme-03.mp4", likes: 41700 },
  { id: "meme-04", src: "assets/memes/meme-04.mp4", likes: 89300 },
  { id: "meme-05", src: "assets/memes/meme-05.mp4", likes: 33400 },
  { id: "meme-06", src: "assets/memes/meme-06.mp4", likes: 57200 },
  { id: "meme-07", src: "assets/memes/meme-07.mp4", likes: 19600 },
  { id: "meme-08", src: "assets/memes/meme-08.mp4", likes: 76100 },
  { id: "meme-09", src: "assets/memes/meme-09.mp4", likes: 29500 },
  { id: "meme-10", src: "assets/memes/meme-10.mp4", likes: 62400 },
  { id: "meme-11", src: "assets/memes/meme-11.mp4", likes: 18300 },
  { id: "meme-12", src: "assets/memes/meme-12.mp4", likes: 45700 },
  { id: "meme-13", src: "assets/memes/meme-13.mp4", likes: 31900 },
  { id: "meme-14", src: "assets/memes/meme-14.mp4", likes: 71800 },
  { id: "meme-15", src: "assets/memes/meme-15.mp4", likes: 26600 },
  { id: "meme-16", src: "assets/memes/meme-16.mp4", likes: 53400 },
  { id: "meme-17", src: "assets/memes/meme-17.mp4", likes: 39700 },
  { id: "meme-18", src: "assets/memes/meme-18.mp4", likes: 84600 }
];

const CELEBRATION_QUIPS = [
  "Time to get a life.",
  "Touch some grass.",
  "Get a job.",
  "Your thumb needs a union.",
  "Productivity left the chat.",
  "Another scroll? Groundbreaking.",
  "Blink twice if you need help.",
  "Your screen time is thriving."
];

const backend = window.BetterIGBackend;
const STORAGE_KEY = "betterig.preferences.v1";
const storage = {
  load() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return saved && typeof saved === "object" ? saved : null;
    } catch { return null; }
  },
  save(user) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ muted: Boolean(user.muted) })); }
    catch { /* The prototype remains usable when browser storage is unavailable. */ }
  }
};

const savedUser = storage.load();
const user = {
  username: "",
  score: 0,
  totalLost: 0,
  likedReels: [],
  totalScrolls: 0,
  roulettePending: false,
  roulette: null,
  marketPending: false,
  market: null,
  nextGameAt: 0,
  nextGameType: null,
  nextPrizeAt: 50,
  prizeWheelPending: false,
  prizeWheel: null,
  muted: true,
  ...(savedUser || {})
};
user.likedReels = Array.isArray(user.likedReels) ? user.likedReels : [];
user.score = Number.isFinite(user.score) ? Math.max(0, user.score) : 0;
user.totalScrolls = Number.isFinite(user.totalScrolls) ? user.totalScrolls : user.score;
user.roulettePending = Boolean(user.roulettePending);
user.marketPending = Boolean(user.marketPending);
user.muted = typeof user.muted === "boolean" ? user.muted : true;
storage.save(user);

const state = {
  user,
  activeInstanceId: null,
  activeReel: null,
  initialized: false,
  batch: 0,
  settleTimer: null,
  lastTap: 0,
  panelReturnFocus: null,
  selectedBet: null,
  selectedRouletteStakeRatio: null,
  rouletteSpinning: false,
  selectedPrediction: null,
  selectedStakeRatio: null,
  marketResolving: false,
  lastBatchReelId: null,
  lastQuip: null,
  authSession: null,
  remoteUserId: null,
  leaders: [],
  pointPending: false,
  leaderboardLoading: false,
  leaderboardUnsubscribe: null,
  leaderboardMode: "scores",
  prizeSpinning: false,
  tutorialStep: 0
};

const els = {
  app: document.querySelector("#appShell"), feed: document.querySelector("#reelsFeed"), onboarding: document.querySelector("#onboarding"),
  onboardingForm: document.querySelector("#onboardingForm"), usernameInput: document.querySelector("#usernameInput"), usernameError: document.querySelector("#usernameError"),
  privacyNote: document.querySelector("#privacyNote"),
  score: document.querySelector("#scoreValue"), scorePill: document.querySelector("#scorePill"), scorePlus: document.querySelector("#scorePlus"),
  leaderboardButton: document.querySelector("#leaderboardButton"), mobileLeaderboardButton: document.querySelector("#mobileLeaderboardButton"),
  leaderboardPanel: document.querySelector("#leaderboardPanel"), leaderboardList: document.querySelector("#leaderboardList"), leaderboardEmpty: document.querySelector("#leaderboardEmpty"), leaderboardTabs: document.querySelector("#leaderboardTabs"), leaderboardSubtitle: document.querySelector("#leaderboardSubtitle"),
  currentUserDock: document.querySelector("#currentUserDock"), closeLeaderboard: document.querySelector("#closeLeaderboard"), panelBackdrop: document.querySelector("#panelBackdrop"),
  toast: document.querySelector("#toast"), pointCelebration: document.querySelector("#pointCelebration"), celebrationQuip: document.querySelector("#celebrationQuip"), confetti: document.querySelector("#confetti"),
  rouletteGate: document.querySelector("#rouletteGate"), rouletteWheel: document.querySelector("#rouletteWheel"), rouletteWager: document.querySelector("#rouletteWager"),
  betOptions: document.querySelector("#betOptions"), rouletteStakeOptions: document.querySelector("#rouletteStakeOptions"), rouletteSpin: document.querySelector("#rouletteSpin"), rouletteResult: document.querySelector("#rouletteResult"), rouletteContinue: document.querySelector("#rouletteContinue"),
  marketGate: document.querySelector("#marketGate"), marketChart: document.querySelector("#marketChart"), marketMove: document.querySelector("#marketMove"), marketBalance: document.querySelector("#marketBalance"),
  predictionOptions: document.querySelector("#predictionOptions"), stakeOptions: document.querySelector("#stakeOptions"), marketSubmit: document.querySelector("#marketSubmit"), marketResult: document.querySelector("#marketResult"), marketContinue: document.querySelector("#marketContinue"),
  milestoneCelebration: document.querySelector("#milestoneCelebration"), milestoneBurst: document.querySelector("#milestoneBurst"), milestoneTotal: document.querySelector("#milestoneTotal"), milestoneQuip: document.querySelector("#milestoneQuip"),
  jackpotCelebration: document.querySelector("#jackpotCelebration"), jackpotBurst: document.querySelector("#jackpotBurst"), moneyRain: document.querySelector("#moneyRain"), jackpotPayout: document.querySelector("#jackpotPayout"),
  prizeGate: document.querySelector("#prizeGate"), prizeWheel: document.querySelector("#prizeWheel"), prizeHubValue: document.querySelector("#prizeHubValue"), prizeSpin: document.querySelector("#prizeSpin"), prizeResult: document.querySelector("#prizeResult"), prizeContinue: document.querySelector("#prizeContinue"),
  tutorial: document.querySelector("#tutorial"), tutorialSkip: document.querySelector("#tutorialSkip"), tutorialProgress: document.querySelector("#tutorialProgress"), tutorialStepLabel: document.querySelector("#tutorialStepLabel"), tutorialTitle: document.querySelector("#tutorialTitle"), tutorialCopy: document.querySelector("#tutorialCopy"), tutorialPlayground: document.querySelector("#tutorialPlayground"), tutorialNext: document.querySelector("#tutorialNext")
};

function applyRemoteState(remote) {
  if (!remote) return;
  state.remoteUserId = remote.user_id || state.remoteUserId;
  state.user.username = remote.username || state.user.username;
  state.user.score = Number(remote.score) || 0;
  state.user.totalScrolls = Number(remote.total_scrolls) || 0;
  state.user.nextGameAt = Number(remote.next_game_at) || state.user.nextGameAt;
  state.user.nextGameType = remote.next_game_type || state.user.nextGameType;
  state.user.totalLost = Number(remote.total_lost) || 0;
  state.user.nextPrizeAt = Number(remote.next_prize_at) || state.user.nextPrizeAt;
  state.user.prizeWheelPending = remote.pending_game === "prize_wheel";
  state.user.roulettePending = remote.pending_game === "roulette";
  state.user.marketPending = remote.pending_game === "market";
  state.user.likedReels = Array.isArray(remote.liked_reels) ? remote.liked_reels : state.user.likedReels;
}

function gatePending() { return state.user.prizeWheelPending || state.user.roulettePending || state.user.marketPending; }

function nextQuip() {
  const choices = CELEBRATION_QUIPS.filter(quip => quip !== state.lastQuip);
  state.lastQuip = choices[Math.floor(Math.random() * choices.length)];
  return state.lastQuip;
}

function shuffledReels() {
  const reels = [...REELS];
  for (let index = reels.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [reels[index], reels[swapIndex]] = [reels[swapIndex], reels[index]];
  }
  if (reels.length > 1 && reels[0].id === state.lastBatchReelId) {
    const swapIndex = reels.findIndex((reel, index) => index > 0 && reel.id !== state.lastBatchReelId);
    [reels[0], reels[swapIndex]] = [reels[swapIndex], reels[0]];
  }
  state.lastBatchReelId = reels.at(-1)?.id || null;
  return reels;
}

function formatCount(value) {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(value >= 10000 ? 0 : 1)}K`;
  return String(value);
}

function escapeHTML(value) {
  return value.replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}

function createReel(reel, index) {
  const instanceId = `${state.batch}-${index}`;
  const liked = state.user.likedReels.includes(reel.id);
  const article = document.createElement("article");
  article.className = "reel";
  article.dataset.reelId = reel.id;
  article.dataset.instanceId = instanceId;
  article.setAttribute("aria-label", `Meme ${index + 1}`);
  article.innerHTML = `
    <div class="media-loader" role="status"><span>Loading meme…</span></div>
    <video class="meme-media" data-src="${reel.src}" playsinline loop preload="none" aria-label="Meme video ${index + 1}"></video>
    <div class="play-state" aria-hidden="true">▶</div>
    <div class="double-heart" aria-hidden="true">♥</div>
    <div class="reel-actions">
      <button class="action-button like-button ${liked ? "is-liked" : ""}" type="button" aria-label="${liked ? "Unlike" : "Like"} this meme" aria-pressed="${liked}">
        <span class="action-icon" aria-hidden="true">${liked ? "♥" : "♡"}</span><span class="action-count">${formatCount(reel.likes + (liked ? 1 : 0))}</span>
      </button>
      <button class="action-button share-button" type="button" aria-label="Share meme"><span class="action-icon" aria-hidden="true">↗</span><span class="action-count">Share</span></button>
      <button class="action-button sound-button" type="button" aria-label="${state.user.muted ? "Turn sound on" : "Mute reels"}" aria-pressed="${state.user.muted}"><span class="action-icon" aria-hidden="true">${state.user.muted ? "🔇" : "🔊"}</span><span class="action-count">${state.user.muted ? "Muted" : "Sound"}</span></button>
    </div>`;

  const media = article.querySelector(".meme-media");
  media.muted = state.user.muted;
  media.addEventListener("canplay", () => article.classList.add("is-ready"), { once: true });
  media.addEventListener("error", () => {
    article.classList.add("is-error");
    article.querySelector(".media-loader span").textContent = "Couldn’t load this meme";
  });
  if (state.batch === 0 && index < 2) ensureMediaLoaded(media, index === 0 ? "auto" : "metadata");
  if (media.readyState >= 3) article.classList.add("is-ready");
  media.addEventListener("click", () => handleMemeTap(article));
  article.querySelector(".like-button").addEventListener("click", () => toggleLike(article));
  article.querySelector(".share-button").addEventListener("click", () => shareReel(reel));
  article.querySelector(".sound-button").addEventListener("click", toggleSound);
  return article;
}

function ensureMediaLoaded(media, preload = "metadata") {
  if (!media) return;
  media.preload = preload;
  if (!media.hasAttribute("src") && media.dataset.src) {
    media.src = media.dataset.src;
    media.load();
  }
}

function prepareNearbyMedia(activeReel) {
  const reels = [...els.feed.querySelectorAll(".reel")];
  const activeIndex = reels.indexOf(activeReel);
  [-1, 0, 1, 2].forEach(offset => {
    const media = reels[activeIndex + offset]?.querySelector(".meme-media");
    ensureMediaLoaded(media, offset === 0 || offset === 1 ? "auto" : "metadata");
  });
}

function appendReelBatch() {
  const fragment = document.createDocumentFragment();
  shuffledReels().forEach((reel, index) => fragment.append(createReel(reel, index)));
  state.batch += 1;
  els.feed.append(fragment);
  observeNewReels();
}

let intersectionObserver;
function observeNewReels() {
  if (!intersectionObserver) {
    intersectionObserver = new IntersectionObserver(entries => {
      const strongest = entries.filter(entry => entry.isIntersecting && entry.intersectionRatio >= 0.72)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!strongest) return;
      clearTimeout(state.settleTimer);
      state.settleTimer = setTimeout(() => activateReel(strongest.target), 180);
    }, { root: els.feed, threshold: [0.5, 0.72, 0.9] });
  }
  els.feed.querySelectorAll(".reel:not([data-observed])").forEach(reel => {
    reel.dataset.observed = "true";
    intersectionObserver.observe(reel);
  });
}

function activateReel(reelEl) {
  if (gatePending() && state.initialized) return;
  const instanceId = reelEl.dataset.instanceId;
  if (state.activeInstanceId === instanceId) return;

  document.querySelectorAll(".meme-media").forEach(media => {
    if (media !== reelEl.querySelector(".meme-media")) media.pause();
  });
  document.querySelectorAll(".reel").forEach(reel => reel.classList.remove("is-active", "is-paused"));
  reelEl.classList.add("is-active");
  const media = reelEl.querySelector(".meme-media");
  prepareNearbyMedia(reelEl);
  media.play().then(() => reelEl.classList.remove("is-paused")).catch(() => reelEl.classList.add("is-paused"));

  const previousInstance = state.activeInstanceId;
  const previousReelId = state.activeReel?.dataset.reelId || null;
  state.activeInstanceId = instanceId;
  state.activeReel = reelEl;

  // The initial observed reel never awards a point. A point is awarded only after
  // a different reel remains the dominant viewport target for the settle period.
  if (state.initialized && previousInstance !== null) {
    awardPoint(previousReelId, reelEl.dataset.reelId);
  } else {
    backend.beginFeed(reelEl.dataset.reelId).catch(() => showToast("Couldn’t start the scoring session"));
  }
  state.initialized = true;

  const reels = [...els.feed.querySelectorAll(".reel")];
  const index = reels.indexOf(reelEl);
  if (index >= reels.length - 3) appendReelBatch();
  if (reels.length > REELS.length * 4 && index > REELS.length * 2) trimOldReels();
}

function trimOldReels() {
  const old = [...els.feed.querySelectorAll(".reel")].slice(0, REELS.length);
  const removedHeight = old.reduce((sum, reel) => sum + reel.getBoundingClientRect().height, 0);
  old.forEach(reel => { intersectionObserver.unobserve(reel); reel.remove(); });
  els.feed.scrollTop -= removedHeight;
}

async function awardPoint(previousReelId, currentReelId) {
  if (state.pointPending || !previousReelId || !currentReelId) return;
  state.pointPending = true;
  let remote;
  try {
    remote = await backend.recordScroll(crypto.randomUUID(), previousReelId, currentReelId);
  } catch (error) {
    await backend.beginFeed(currentReelId).catch(() => {});
    showToast(error.message?.includes("too fast") ? "Scroll didn’t settle — no point" : "Point not saved. Check your connection.");
    state.pointPending = false;
    return;
  }
  applyRemoteState(remote);
  const reachedMilestone = state.user.totalScrolls % 10 === 0;
  state.user.market = null;
  state.user.roulette = null;
  state.user.prizeWheel = null;
  if (gatePending()) document.body.classList.add("roulette-locked");
  updateScore();
  renderLeaderboard();
  refreshLeaderboard();
  els.scorePill.classList.remove("is-earning");
  void els.scorePill.offsetWidth;
  els.scorePill.classList.add("is-earning");
  setTimeout(() => els.scorePill.classList.remove("is-earning"), 720);
  celebratePoint();
  if (reachedMilestone) triggerMilestone(state.user.totalScrolls);
  const gateDelay = reachedMilestone ? 2350 : 900;
  if (state.user.prizeWheelPending) setTimeout(openPrizeWheel, gateDelay);
  else if (state.user.marketPending) setTimeout(openMarket, gateDelay);
  else if (state.user.roulettePending) setTimeout(openRoulette, gateDelay);
  state.pointPending = false;
}

let celebrationTimer;
function celebratePoint() {
  clearTimeout(celebrationTimer);
  els.celebrationQuip.textContent = nextQuip();
  const colors = ["#d8ff4f", "#ff477e", "#ffffff", "#8e6cff", "#38e8c1"];
  els.confetti.replaceChildren();
  for (let index = 0; index < 22; index += 1) {
    const piece = document.createElement("span");
    const angle = (Math.PI * 2 * index) / 22 + Math.random() * 0.24;
    const distance = 130 + Math.random() * 180;
    piece.className = "confetti-piece";
    piece.style.setProperty("--piece-color", colors[index % colors.length]);
    piece.style.setProperty("--piece-x", `${Math.cos(angle) * distance}px`);
    piece.style.setProperty("--piece-y", `${Math.sin(angle) * distance}px`);
    piece.style.setProperty("--piece-rotation", `${Math.round(Math.random() * 180)}deg`);
    piece.style.setProperty("--piece-delay", `${Math.random() * 0.08}s`);
    els.confetti.append(piece);
  }
  els.pointCelebration.classList.remove("is-active");
  void els.pointCelebration.offsetWidth;
  els.pointCelebration.classList.add("is-active");
  celebrationTimer = setTimeout(() => els.pointCelebration.classList.remove("is-active"), 980);
}

let milestoneTimer;
function triggerMilestone(total) {
  clearTimeout(milestoneTimer);
  const colors = ["#d8ff4f", "#ff477e", "#ffffff", "#8e6cff", "#38e8c1", "#ffd84f"];
  els.milestoneBurst.replaceChildren();
  els.milestoneTotal.textContent = total.toLocaleString();
  els.milestoneQuip.textContent = nextQuip();
  for (let index = 0; index < 56; index += 1) {
    const piece = document.createElement("span");
    const angle = Math.random() * Math.PI * 2;
    const distance = 150 + Math.random() * 430;
    piece.className = "milestone-piece";
    piece.style.setProperty("--milestone-color", colors[index % colors.length]);
    piece.style.setProperty("--milestone-size", `${6 + Math.random() * 8}px`);
    piece.style.setProperty("--milestone-x", `${Math.cos(angle) * distance}px`);
    piece.style.setProperty("--milestone-y", `${Math.sin(angle) * distance}px`);
    piece.style.setProperty("--milestone-rotation", `${360 + Math.random() * 620}deg`);
    piece.style.setProperty("--milestone-delay", `${Math.random() * .38}s`);
    els.milestoneBurst.append(piece);
  }
  els.milestoneCelebration.classList.remove("is-active");
  void els.milestoneCelebration.offsetWidth;
  els.milestoneCelebration.classList.add("is-active");
  milestoneTimer = setTimeout(() => els.milestoneCelebration.classList.remove("is-active"), 2280);
}

function updateScore() { els.score.textContent = String(state.user.score); }

function toggleSound() {
  state.user.muted = !state.user.muted;
  storage.save(state.user);
  document.querySelectorAll(".meme-media").forEach(media => { media.muted = state.user.muted; });
  document.querySelectorAll(".sound-button").forEach(button => {
    button.setAttribute("aria-label", state.user.muted ? "Turn sound on" : "Mute reels");
    button.setAttribute("aria-pressed", String(state.user.muted));
    button.querySelector(".action-icon").textContent = state.user.muted ? "🔇" : "🔊";
    button.querySelector(".action-count").textContent = state.user.muted ? "Muted" : "Sound";
  });
  if (state.activeReel) state.activeReel.querySelector(".meme-media").play().catch(() => {});
  showToast(state.user.muted ? "Reels muted" : "Sound on");
}

async function toggleLike(reelEl, forceLike = false) {
  const reelId = reelEl.dataset.reelId;
  const reel = REELS.find(item => item.id === reelId);
  const isLiked = state.user.likedReels.includes(reelId);
  const nextLiked = forceLike || !isLiked;
  let visualLiked = nextLiked;
  if (nextLiked === isLiked && forceLike) return;
  state.user.likedReels = nextLiked ? [...state.user.likedReels, reelId] : state.user.likedReels.filter(id => id !== reelId);
  try {
    const remote = await backend.setLike(reelId, nextLiked);
    applyRemoteState(remote);
  } catch {
    state.user.likedReels = isLiked ? [...state.user.likedReels, reelId] : state.user.likedReels.filter(id => id !== reelId);
    visualLiked = isLiked;
    showToast("Like wasn’t saved");
  }
  document.querySelectorAll(`[data-reel-id="${reelId}"] .like-button`).forEach(button => {
    button.classList.toggle("is-liked", visualLiked);
    button.setAttribute("aria-pressed", String(visualLiked));
    button.setAttribute("aria-label", `${visualLiked ? "Unlike" : "Like"} this meme`);
    button.querySelector(".action-icon").textContent = visualLiked ? "♥" : "♡";
    button.querySelector(".action-count").textContent = formatCount(reel.likes + (visualLiked ? 1 : 0));
  });
}

function handleMemeTap(reelEl) {
  const now = Date.now();
  if (now - state.lastTap < 320) {
    toggleLike(reelEl, true);
    const heart = reelEl.querySelector(".double-heart");
    heart.classList.remove("burst"); void heart.offsetWidth; heart.classList.add("burst");
    state.lastTap = 0;
    return;
  }
  state.lastTap = now;
  setTimeout(() => {
    if (state.lastTap !== now) return;
    state.lastTap = 0;
    const media = reelEl.querySelector(".meme-media");
    if (media.paused) { media.play().catch(() => {}); reelEl.classList.remove("is-paused"); }
    else { media.pause(); reelEl.classList.add("is-paused"); }
  }, 330);
}

function scrollReel(direction) {
  if (gatePending() || state.pointPending) return;
  if (!state.activeReel) return;
  const target = direction > 0 ? state.activeReel.nextElementSibling : state.activeReel.previousElementSibling;
  if (target?.classList.contains("reel")) target.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
}

let wheelHandled = false;
let wheelReleaseTimer;
els.feed.addEventListener("wheel", event => {
  event.preventDefault();
  if (gatePending() || Math.abs(event.deltaY) < 10) return;
  clearTimeout(wheelReleaseTimer);
  wheelReleaseTimer = setTimeout(() => { wheelHandled = false; }, 180);
  if (wheelHandled) return;
  wheelHandled = true;
  scrollReel(event.deltaY > 0 ? 1 : -1);
}, { passive: false });

let touchStartY = null;
let touchCurrentY = null;
els.feed.addEventListener("touchstart", event => {
  if (event.touches.length !== 1 || gatePending()) return;
  touchStartY = event.touches[0].clientY;
  touchCurrentY = touchStartY;
}, { passive: true });
els.feed.addEventListener("touchmove", event => {
  if (touchStartY === null || event.touches.length !== 1) return;
  touchCurrentY = event.touches[0].clientY;
  event.preventDefault();
}, { passive: false });
els.feed.addEventListener("touchend", () => {
  if (touchStartY === null || touchCurrentY === null) return;
  const distance = touchStartY - touchCurrentY;
  touchStartY = null;
  touchCurrentY = null;
  if (Math.abs(distance) >= 38) scrollReel(distance > 0 ? 1 : -1);
}, { passive: true });

function renderLeaderboard() {
  const showingLosses = state.leaderboardMode === "losses";
  els.leaderboardTabs.querySelectorAll("button").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.board === state.leaderboardMode));
  });
  els.leaderboardSubtitle.textContent = showingLosses
    ? "A permanent hall of pain for every lost stake."
    : "Every intentional scroll moves you up.";
  const ranked = state.leaders.map(item => ({
    userId: item.user_id,
    username: item.user_id === state.remoteUserId ? state.user.username : item.username,
    score: showingLosses
      ? (item.user_id === state.remoteUserId ? state.user.totalLost : (Number(item.total_lost) || 0))
      : (item.user_id === state.remoteUserId ? state.user.score : (Number(item.score) || 0)),
    avatar: item.avatar_url || "",
    current: item.user_id === state.remoteUserId
  })).sort((a, b) => b.score - a.score || a.username.localeCompare(b.username));
  let current = ranked.find(item => item.current);
  if (!current && state.user.username) {
    current = { userId: state.remoteUserId, username: state.user.username, score: showingLosses ? state.user.totalLost : state.user.score, avatar: "", current: true };
    ranked.push(current);
    ranked.sort((a, b) => b.score - a.score || a.username.localeCompare(b.username));
  }
  const currentRank = current ? ranked.findIndex(user => user.current) + 1 : 0;
  const visible = ranked.slice(0, 8);
  if (current && !visible.some(user => user.current)) visible.push(current);
  els.leaderboardList.innerHTML = visible.map(user => leaderRow(user, ranked.findIndex(item => item === user) + 1)).join("");
  els.currentUserDock.innerHTML = current ? leaderRow(current, currentRank, true) : "";
  els.leaderboardEmpty.hidden = ranked.length > 0;
}

async function refreshLeaderboard() {
  if (state.leaderboardLoading) return;
  state.leaderboardLoading = true;
  if (!state.leaders.length) els.leaderboardList.innerHTML = `<div class="leaderboard-loading">Loading global scores…</div>`;
  try {
    state.leaders = await backend.getLeaderboard();
    renderLeaderboard();
  } catch {
    if (!state.leaders.length) els.leaderboardList.innerHTML = `<div class="leaderboard-loading">Couldn’t load scores. Try again shortly.</div>`;
  } finally {
    state.leaderboardLoading = false;
  }
}

function leaderRow(user, rank, dock = false) {
  const medals = { 1: "🥇", 2: "🥈", 3: "🥉" };
  const initial = escapeHTML(user.username.charAt(0).toUpperCase());
  const avatar = user.avatar ? `<img class="leader-avatar" src="${user.avatar}" alt="" />` : `<span class="leader-avatar avatar-fallback">${initial}</span>`;
  const lossLabels = ["BIGGEST LOSER", "PAIN RUNNER-UP", "TOP THREE LOSER"];
  const scoreLabels = ["SCROLL CHAMPION", "RUNNER UP", "TOP THREE"];
  const label = user.current ? "YOU" : rank <= 3 ? (state.leaderboardMode === "losses" ? lossLabels : scoreLabels)[rank - 1] : dock ? "YOUR POSITION" : "";
  const suffix = state.leaderboardMode === "losses" ? " lost" : "";
  return `<div class="leader-row ${user.current ? "is-current" : ""} ${rank <= 3 ? `top-${rank}` : ""}">
    <span class="rank" aria-label="Rank ${rank}">${medals[rank] || rank}</span>${avatar}
    <div class="leader-details"><p class="leader-name">@${escapeHTML(user.username)}</p>${label ? `<div class="leader-badge">${label}</div>` : ""}</div>
    <span class="leader-score">${user.score.toLocaleString()}${suffix}</span>
  </div>`;
}

function openLeaderboard(trigger) {
  state.panelReturnFocus = trigger;
  renderLeaderboard();
  refreshLeaderboard();
  els.panelBackdrop.hidden = false;
  els.leaderboardPanel.classList.add("is-open");
  els.leaderboardPanel.setAttribute("aria-hidden", "false");
  els.leaderboardButton.setAttribute("aria-expanded", "true");
  setTimeout(() => els.closeLeaderboard.focus(), 50);
}

function closeLeaderboard() {
  els.leaderboardPanel.classList.remove("is-open");
  els.leaderboardPanel.setAttribute("aria-hidden", "true");
  els.leaderboardButton.setAttribute("aria-expanded", "false");
  setTimeout(() => { els.panelBackdrop.hidden = true; state.panelReturnFocus?.focus(); }, 350);
}

function openMarket() {
  if (!state.user.marketPending) return;
  if (state.user.prizeWheelPending) return;
  document.querySelectorAll(".meme-media").forEach(media => media.pause());
  els.leaderboardPanel.classList.remove("is-open");
  els.leaderboardPanel.setAttribute("aria-hidden", "true");
  els.leaderboardButton.setAttribute("aria-expanded", "false");
  els.panelBackdrop.hidden = true;
  document.body.classList.add("roulette-locked");
  els.app.setAttribute("aria-hidden", "true");
  els.marketGate.classList.add("is-open");
  els.marketGate.setAttribute("aria-hidden", "false");
  els.marketBalance.textContent = state.user.score.toLocaleString();

  if (state.user.market) {
    const round = state.user.market;
    state.selectedPrediction = round.prediction;
    state.selectedStakeRatio = round.stakeRatio;
    setMarketSelection();
    showMarketResult(round);
  } else {
    state.selectedPrediction = null;
    state.selectedStakeRatio = null;
    state.marketResolving = false;
    setMarketSelection();
    els.marketChart.className = "market-chart";
    els.marketMove.textContent = "?";
    els.marketSubmit.hidden = false;
    els.marketSubmit.disabled = true;
    els.marketSubmit.textContent = "Choose direction and stake";
    els.marketContinue.hidden = true;
    els.marketResult.className = "market-result";
    els.marketResult.textContent = "";
    setTimeout(() => els.predictionOptions.querySelector("button").focus(), 60);
  }
}

function setMarketSelection() {
  els.predictionOptions.querySelectorAll("button").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.prediction === state.selectedPrediction));
    button.disabled = Boolean(state.user.market) || state.marketResolving;
  });
  els.stakeOptions.querySelectorAll("button").forEach(button => {
    button.setAttribute("aria-pressed", String(Number(button.dataset.stake) === state.selectedStakeRatio));
    button.disabled = Boolean(state.user.market) || state.marketResolving;
  });
}

function updateMarketSubmit() {
  setMarketSelection();
  if (!state.selectedPrediction || !state.selectedStakeRatio) {
    els.marketSubmit.disabled = true;
    els.marketSubmit.textContent = "Choose direction and stake";
    return;
  }
  const stake = Math.max(1, Math.floor(state.user.score * state.selectedStakeRatio));
  els.marketSubmit.disabled = false;
  els.marketSubmit.textContent = `Bet ${stake.toLocaleString()} on ${state.selectedPrediction.toUpperCase()}`;
}

async function resolveMarket() {
  if (!state.selectedPrediction || !state.selectedStakeRatio || state.marketResolving || state.user.market) return;
  state.marketResolving = true;
  setMarketSelection();
  els.marketSubmit.disabled = true;
  els.marketSubmit.textContent = "Market moving…";
  els.marketChart.className = "market-chart is-resolving";
  els.marketMove.textContent = "…";

  let result;
  try {
    result = await backend.resolveMarket(state.selectedPrediction, state.selectedStakeRatio);
  } catch (error) {
    state.marketResolving = false;
    setMarketSelection();
    updateMarketSubmit();
    els.marketChart.className = "market-chart";
    els.marketMove.textContent = "?";
    showToast(error.message || "Market result couldn’t be saved");
    return;
  }
  applyRemoteState(result.state);
  const round = {
    prediction: result.prediction,
    stakeRatio: Number(result.stake_ratio),
    stake: Number(result.stake),
    outcome: result.outcome,
    win: result.win,
    winnings: Number(result.winnings),
    finalScore: Number(result.final_score)
  };
  state.user.market = round;
  updateScore();
  renderLeaderboard();
  refreshLeaderboard();
  const resolveTime = matchMedia("(prefers-reduced-motion: reduce)").matches ? 80 : 2600;
  setTimeout(() => showMarketResult(round), resolveTime);
}

function showMarketResult(round) {
  state.marketResolving = false;
  setMarketSelection();
  els.marketChart.className = `market-chart is-${round.outcome}`;
  els.marketMove.textContent = round.outcome === "up" ? "↗" : "↘";
  els.marketSubmit.hidden = true;
  els.marketResult.className = `market-result ${round.win ? "is-win" : "is-loss"}`;
  els.marketResult.textContent = round.win
    ? `${round.outcome.toUpperCase()}! Your ${round.stake.toLocaleString()} stake paid ${round.winnings.toLocaleString()}.`
    : `${round.outcome.toUpperCase()}. You lost your ${round.stake.toLocaleString()} scroll stake.`;
  els.marketContinue.hidden = false;
  els.marketContinue.disabled = round.win;
  if (round.win) {
    triggerJackpot({ payout: round.winnings });
    setTimeout(() => { els.marketContinue.disabled = false; els.marketContinue.focus(); }, 3050);
  } else {
    setTimeout(() => els.marketContinue.focus(), 60);
  }
}

function completeMarket() {
  if (!state.user.market) return;
  state.user.marketPending = false;
  state.user.market = null;
  storage.save(state.user);
  state.selectedPrediction = null;
  state.selectedStakeRatio = null;
  els.marketGate.classList.remove("is-open");
  els.marketGate.setAttribute("aria-hidden", "true");
  if (state.user.roulettePending) {
    setTimeout(openRoulette, 320);
    return;
  }
  els.app.setAttribute("aria-hidden", "false");
  document.body.classList.remove("roulette-locked");
  setTimeout(() => {
    els.feed.focus({ preventScroll: true });
    state.activeReel?.querySelector(".meme-media")?.play().catch(() => {});
  }, 320);
}

const ROULETTE_SEGMENTS = ["green", "red", "black", "red", "black", "red", "black", "green", "red", "black", "red", "black", "red", "black"];
const SEGMENT_ANGLE = 360 / ROULETTE_SEGMENTS.length;

function openRoulette() {
  if (!state.user.roulettePending) return;
  if (state.user.prizeWheelPending || state.user.marketPending) return;
  document.querySelectorAll(".meme-media").forEach(media => media.pause());
  els.leaderboardPanel.classList.remove("is-open");
  els.leaderboardPanel.setAttribute("aria-hidden", "true");
  els.leaderboardButton.setAttribute("aria-expanded", "false");
  els.panelBackdrop.hidden = true;
  document.body.classList.add("roulette-locked");
  els.app.setAttribute("aria-hidden", "true");
  els.rouletteGate.classList.add("is-open");
  els.rouletteGate.setAttribute("aria-hidden", "false");
  els.rouletteWager.textContent = state.user.score.toLocaleString();

  if (state.user.roulette) {
    const round = state.user.roulette;
    state.selectedBet = round.bet;
    state.selectedRouletteStakeRatio = round.stakeRatio;
    setSelectedBet(round.bet);
    els.rouletteWheel.style.transition = "none";
    els.rouletteWheel.style.transform = `rotate(${360 - round.outcomeIndex * SEGMENT_ANGLE}deg)`;
    showRouletteResult(round);
  } else {
    state.selectedBet = null;
    state.selectedRouletteStakeRatio = null;
    state.rouletteSpinning = false;
    setSelectedBet(null);
    els.rouletteWheel.style.transition = "none";
    els.rouletteWheel.style.transform = "rotate(0deg)";
    els.rouletteSpin.hidden = false;
    els.rouletteSpin.disabled = true;
    els.rouletteSpin.textContent = "Choose color and stake";
    els.rouletteContinue.hidden = true;
    els.rouletteResult.textContent = "";
    els.rouletteResult.className = "roulette-result";
    setTimeout(() => els.betOptions.querySelector("button").focus(), 60);
  }
}

function setSelectedBet(color) {
  els.betOptions.querySelectorAll(".bet-button").forEach(button => {
    button.setAttribute("aria-pressed", String(button.dataset.bet === color));
    button.disabled = Boolean(state.user.roulette) || state.rouletteSpinning;
  });
  els.rouletteStakeOptions.querySelectorAll("button[data-stake]").forEach(button => {
    button.setAttribute("aria-pressed", String(Number(button.dataset.stake) === state.selectedRouletteStakeRatio));
    button.disabled = Boolean(state.user.roulette) || state.rouletteSpinning;
  });
}

function selectBet(color) {
  if (state.rouletteSpinning || state.user.roulette) return;
  state.selectedBet = color;
  setSelectedBet(color);
  updateRouletteSubmit();
}

function selectRouletteStake(ratio) {
  if (state.rouletteSpinning || state.user.roulette) return;
  state.selectedRouletteStakeRatio = ratio;
  setSelectedBet(state.selectedBet);
  updateRouletteSubmit();
}

function updateRouletteSubmit() {
  if (!state.selectedBet || !state.selectedRouletteStakeRatio) {
    els.rouletteSpin.disabled = true;
    els.rouletteSpin.textContent = "Choose color and stake";
    return;
  }
  const wager = state.user.score === 0 ? 0 : Math.max(1, Math.floor(state.user.score * state.selectedRouletteStakeRatio));
  els.rouletteSpin.disabled = false;
  els.rouletteSpin.textContent = `Bet ${wager.toLocaleString()} on ${state.selectedBet}`;
}

async function spinRoulette() {
  if (!state.selectedBet || !state.selectedRouletteStakeRatio || state.rouletteSpinning || state.user.roulette) return;
  state.rouletteSpinning = true;
  setSelectedBet(state.selectedBet);
  els.rouletteSpin.disabled = true;
  els.rouletteSpin.textContent = "Spinning…";

  let result;
  try {
    result = await backend.resolveRoulette(state.selectedBet, state.selectedRouletteStakeRatio);
  } catch (error) {
    state.rouletteSpinning = false;
    setSelectedBet(state.selectedBet);
    els.rouletteSpin.disabled = false;
    updateRouletteSubmit();
    showToast(error.message || "Roulette result couldn’t be saved");
    return;
  }
  applyRemoteState(result.state);
  const round = {
    bet: result.bet,
    wager: Number(result.wager),
    stakeRatio: Number(result.stake_ratio),
    outcome: result.outcome,
    outcomeIndex: Number(result.outcome_index),
    win: result.win,
    payout: Number(result.payout)
  };
  state.user.roulette = round;
  updateScore();
  renderLeaderboard();
  refreshLeaderboard();

  els.rouletteWheel.style.transition = "none";
  els.rouletteWheel.style.transform = "rotate(0deg)";
  void els.rouletteWheel.offsetWidth;
  els.rouletteWheel.style.transition = "";
  els.rouletteWheel.style.transform = `rotate(${2160 - round.outcomeIndex * SEGMENT_ANGLE}deg)`;

  const spinTime = matchMedia("(prefers-reduced-motion: reduce)").matches ? 80 : 4100;
  setTimeout(() => showRouletteResult(round), spinTime);
}

function showRouletteResult(round) {
  state.rouletteSpinning = false;
  setSelectedBet(round.bet);
  els.rouletteSpin.hidden = true;
  els.rouletteResult.className = `roulette-result ${round.win ? "is-win" : "is-loss"}`;
  els.rouletteResult.textContent = round.win
    ? `${round.outcome.toUpperCase()}! You won ${round.payout.toLocaleString()} scrolls.`
    : `${round.outcome.toUpperCase()}. You lost ${round.wager.toLocaleString()} scrolls.`;
  els.rouletteContinue.hidden = false;
  els.rouletteContinue.disabled = round.win;
  if (round.win) {
    triggerJackpot(round);
    setTimeout(() => { els.rouletteContinue.disabled = false; els.rouletteContinue.focus(); }, 3050);
  } else {
    setTimeout(() => els.rouletteContinue.focus(), 60);
  }
}

let jackpotTimer;
function triggerJackpot(round) {
  clearTimeout(jackpotTimer);
  const colors = ["#d8ff4f", "#ff477e", "#ffffff", "#8e6cff", "#38e8c1", "#ffd84f"];
  els.jackpotBurst.replaceChildren();
  els.moneyRain.replaceChildren();
  els.jackpotPayout.textContent = `${round.payout.toLocaleString()} SCROLLS`;

  for (let index = 0; index < 84; index += 1) {
    const piece = document.createElement("span");
    const angle = Math.random() * Math.PI * 2;
    const distance = 180 + Math.random() * 520;
    piece.className = "jackpot-piece";
    piece.style.setProperty("--jackpot-color", colors[index % colors.length]);
    piece.style.setProperty("--jackpot-size", `${6 + Math.random() * 8}px`);
    piece.style.setProperty("--jackpot-x", `${Math.cos(angle) * distance}px`);
    piece.style.setProperty("--jackpot-y", `${Math.sin(angle) * distance}px`);
    piece.style.setProperty("--jackpot-rotation", `${360 + Math.random() * 720}deg`);
    piece.style.setProperty("--jackpot-delay", `${Math.random() * 0.55}s`);
    els.jackpotBurst.append(piece);
  }

  const moneySymbols = ["💵", "💸", "$", "$", "💰"];
  for (let index = 0; index < 30; index += 1) {
    const money = document.createElement("span");
    money.className = "money-piece";
    money.textContent = moneySymbols[index % moneySymbols.length];
    money.style.setProperty("--money-x", `${Math.random() * 100}%`);
    money.style.setProperty("--money-size", `${22 + Math.random() * 24}px`);
    money.style.setProperty("--money-delay", `${Math.random() * 1.25}s`);
    money.style.setProperty("--money-duration", `${1.5 + Math.random() * 1.15}s`);
    money.style.setProperty("--money-drift", `${-70 + Math.random() * 140}px`);
    money.style.setProperty("--money-rotation", `${-360 + Math.random() * 720}deg`);
    els.moneyRain.append(money);
  }

  els.jackpotCelebration.classList.remove("is-active");
  void els.jackpotCelebration.offsetWidth;
  els.jackpotCelebration.classList.add("is-active");
  jackpotTimer = setTimeout(() => els.jackpotCelebration.classList.remove("is-active"), 3150);
}

function completeRoulette() {
  if (!state.user.roulette) return;
  state.user.roulettePending = false;
  state.user.roulette = null;
  storage.save(state.user);
  state.selectedBet = null;
  state.selectedRouletteStakeRatio = null;
  els.rouletteGate.classList.remove("is-open");
  els.rouletteGate.setAttribute("aria-hidden", "true");
  if (state.user.marketPending) {
    setTimeout(openMarket, 320);
    return;
  }
  els.app.setAttribute("aria-hidden", "false");
  document.body.classList.remove("roulette-locked");
  updateScore();
  renderLeaderboard();
  setTimeout(() => {
    els.feed.focus({ preventScroll: true });
    state.activeReel?.querySelector(".meme-media")?.play().catch(() => {});
  }, 320);
}

const PRIZE_SEGMENT_ANGLE = 12;

function openPrizeWheel() {
  if (!state.user.prizeWheelPending) return;
  document.querySelectorAll(".meme-media").forEach(media => media.pause());
  els.leaderboardPanel.classList.remove("is-open");
  els.leaderboardPanel.setAttribute("aria-hidden", "true");
  els.leaderboardButton.setAttribute("aria-expanded", "false");
  els.panelBackdrop.hidden = true;
  document.body.classList.add("roulette-locked");
  els.app.setAttribute("aria-hidden", "true");
  els.prizeGate.classList.add("is-open");
  els.prizeGate.setAttribute("aria-hidden", "false");

  state.prizeSpinning = false;
  state.user.prizeWheel = null;
  els.prizeWheel.style.transition = "none";
  els.prizeWheel.style.transform = "rotate(0deg)";
  els.prizeHubValue.textContent = "?";
  els.prizeSpin.hidden = false;
  els.prizeSpin.disabled = false;
  els.prizeSpin.textContent = "Spin my free reward";
  els.prizeResult.textContent = "";
  els.prizeContinue.hidden = true;
  setTimeout(() => els.prizeSpin.focus(), 60);
}

async function spinPrizeWheel() {
  if (state.prizeSpinning || state.user.prizeWheel) return;
  state.prizeSpinning = true;
  els.prizeSpin.disabled = true;
  els.prizeSpin.textContent = "Finding your reward…";
  els.prizeHubValue.textContent = "…";

  let result;
  try {
    result = await backend.resolvePrizeWheel();
  } catch (error) {
    state.prizeSpinning = false;
    els.prizeSpin.disabled = false;
    els.prizeSpin.textContent = "Spin my free reward";
    els.prizeHubValue.textContent = "?";
    showToast(error.message || "The prize wheel couldn’t connect");
    return;
  }

  applyRemoteState(result.state);
  const round = { prize: Number(result.prize), outcomeIndex: Number(result.outcome_index) };
  state.user.prizeWheel = round;
  updateScore();
  renderLeaderboard();
  refreshLeaderboard();

  els.prizeWheel.style.transition = "none";
  els.prizeWheel.style.transform = "rotate(0deg)";
  void els.prizeWheel.offsetWidth;
  els.prizeWheel.style.transition = "";
  els.prizeWheel.style.transform = `rotate(${2160 - round.outcomeIndex * PRIZE_SEGMENT_ANGLE}deg)`;
  const spinTime = matchMedia("(prefers-reduced-motion: reduce)").matches ? 80 : 3900;
  setTimeout(() => showPrizeResult(round), spinTime);
}

function showPrizeResult(round) {
  state.prizeSpinning = false;
  els.prizeHubValue.textContent = `+${round.prize.toLocaleString()}`;
  els.prizeSpin.hidden = true;
  els.prizeResult.textContent = `FREE +${round.prize.toLocaleString()} SCROLLS!`;
  els.prizeContinue.hidden = false;
  els.prizeContinue.disabled = true;
  triggerJackpot({ payout: round.prize });
  setTimeout(() => {
    els.prizeContinue.disabled = false;
    els.prizeContinue.focus();
  }, 3050);
}

function completePrizeWheel() {
  if (!state.user.prizeWheel) return;
  state.user.prizeWheelPending = false;
  state.user.prizeWheel = null;
  els.prizeGate.classList.remove("is-open");
  els.prizeGate.setAttribute("aria-hidden", "true");
  els.app.setAttribute("aria-hidden", "false");
  document.body.classList.remove("roulette-locked");
  setTimeout(() => {
    els.feed.focus({ preventScroll: true });
    state.activeReel?.querySelector(".meme-media")?.play().catch(() => {});
  }, 320);
}

function trapModalFocus(event) {
  if (event.key !== "Tab") return;
  const modal = els.tutorial.classList.contains("is-open") ? els.tutorial
    : els.prizeGate.classList.contains("is-open") ? els.prizeGate
    : els.marketGate.classList.contains("is-open") ? els.marketGate
    : els.rouletteGate.classList.contains("is-open") ? els.rouletteGate
    : els.leaderboardPanel.classList.contains("is-open") ? els.leaderboardPanel : null;
  if (!modal) return;
  const focusable = [...modal.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])')]
    .filter(element => !element.disabled && element.offsetParent !== null);
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

async function shareReel(reel) {
  const data = { title: "BetterIG meme", text: "This one made the BetterIG feed." };
  try {
    if (navigator.share) await navigator.share(data);
    else if (navigator.clipboard) { await navigator.clipboard.writeText(`${data.title} — ${data.text}`); showToast("Reel details copied"); }
    else showToast("Sharing is unavailable in this browser");
  } catch (error) { if (error.name !== "AbortError") showToast("Couldn’t share this reel"); }
}

let toastTimer;
function showToast(message) {
  clearTimeout(toastTimer); els.toast.textContent = message; els.toast.classList.add("is-visible");
  toastTimer = setTimeout(() => els.toast.classList.remove("is-visible"), 1800);
}

const TUTORIAL_STEPS = [
  {
    title: "Swipe to score.",
    copy: "Move this reel upward. Every valid reel change earns exactly one scroll point."
  },
  {
    title: "Like what hits.",
    copy: "Tap the heart—or double-tap a real reel—to save a meme to this browser."
  },
  {
    title: "Expect chaos.",
    copy: "Spin the demo wheel to reveal when BetterIG’s bonus rounds appear."
  }
];

function tutorialReelMarkup({ likeEnabled = false } = {}) {
  const reel = REELS[0];
  return `<div class="tutorial-reel-shell" role="button" tabindex="0" aria-label="Practice reel. Swipe upward or press Enter.">
      <div class="media-loader" role="status"><span>Loading meme…</span></div>
      <video class="tutorial-reel-video" src="${reel.src}" playsinline loop muted preload="auto" aria-label="Practice meme video"></video>
      <div class="tutorial-handle" aria-hidden="true"><span>↑</span>SWIPE UP</div>
    </div>
    <div class="tutorial-demo-actions">
      <button class="action-button tutorial-heart" type="button" aria-label="Like the practice reel" aria-pressed="false" ${likeEnabled ? "" : "tabindex=\"-1\""}>
        <span class="action-icon" aria-hidden="true">♡</span><span class="action-count">24.8K</span>
      </button>
      <span class="action-button" aria-hidden="true"><span class="action-icon">↗</span><span class="action-count">Share</span></span>
      <span class="action-button sound-button" aria-hidden="true"><span class="action-icon">🔇</span><span class="action-count">Muted</span></span>
    </div>`;
}

function startTutorialVideo() {
  const shell = els.tutorialPlayground.querySelector(".tutorial-reel-shell");
  const video = shell?.querySelector(".tutorial-reel-video");
  if (!video) return;
  const ready = () => shell.classList.add("is-ready");
  video.addEventListener("canplay", ready, { once: true });
  if (video.readyState >= 3) ready();
  video.play().catch(() => {});
}

function openTutorial() {
  document.querySelectorAll(".meme-media").forEach(media => media.pause());
  state.tutorialStep = 0;
  document.body.classList.add("roulette-locked");
  els.app.setAttribute("aria-hidden", "true");
  els.tutorial.classList.add("is-open");
  els.tutorial.setAttribute("aria-hidden", "false");
  renderTutorialStep();
}

function renderTutorialStep() {
  const step = TUTORIAL_STEPS[state.tutorialStep];
  els.tutorialStepLabel.textContent = `QUICK START · ${state.tutorialStep + 1} OF ${TUTORIAL_STEPS.length}`;
  els.tutorialTitle.textContent = step.title;
  els.tutorialCopy.textContent = step.copy;
  els.tutorialPlayground.dataset.complete = "false";
  [...els.tutorialProgress.children].forEach((dot, index) => dot.classList.toggle("is-active", index === state.tutorialStep));
  els.tutorialNext.hidden = true;
  els.tutorialNext.classList.remove("is-ready");

  if (state.tutorialStep === 0) {
    els.tutorialPlayground.innerHTML = tutorialReelMarkup();
    startTutorialVideo();
    setupTutorialSwipe();
  } else if (state.tutorialStep === 1) {
    els.tutorialPlayground.innerHTML = tutorialReelMarkup({ likeEnabled: true });
    els.tutorialPlayground.querySelector(".tutorial-handle").innerHTML = `<span>♡</span>TAP THE HEART`;
    startTutorialVideo();
    els.tutorialPlayground.querySelector(".tutorial-heart").addEventListener("click", completeTutorialInteraction);
    els.tutorialPlayground.querySelector(".tutorial-reel-shell").addEventListener("dblclick", completeTutorialInteraction);
  } else {
    els.tutorialPlayground.innerHTML = `${tutorialReelMarkup()}<div class="tutorial-wheel-overlay"><div class="tutorial-wheel-wrap"><span class="tutorial-wheel-cta" aria-hidden="true">CLICK ME <b>↓</b></span><span class="tutorial-wheel-pointer" aria-hidden="true"></span><button class="tutorial-wheel-demo" type="button" aria-label="Click to spin the bonus preview"><span>SPIN</span></button></div></div>`;
    startTutorialVideo();
    els.tutorialPlayground.querySelector(".tutorial-wheel-demo").addEventListener("click", completeTutorialInteraction);
  }
  setTimeout(() => els.tutorialPlayground.querySelector(".tutorial-reel-shell, button:not([tabindex='-1'])")?.focus(), 40);
}

function setupTutorialSwipe() {
  const card = els.tutorialPlayground.querySelector(".tutorial-reel-shell");
  let startY = null;
  let moved = false;
  card.addEventListener("pointerdown", event => {
    startY = event.clientY;
    moved = false;
    card.setPointerCapture(event.pointerId);
  });
  card.addEventListener("pointermove", event => {
    if (startY === null) return;
    const distance = Math.min(0, event.clientY - startY);
    moved = moved || Math.abs(distance) > 8;
    card.style.setProperty("--tutorial-drag", `${Math.max(-120, distance)}px`);
  });
  card.addEventListener("pointerup", event => {
    if (startY === null) return;
    const distance = event.clientY - startY;
    startY = null;
    if (distance <= -48) completeTutorialInteraction();
    else card.style.setProperty("--tutorial-drag", "0px");
  });
  card.addEventListener("click", () => {
    if (!moved) completeTutorialInteraction();
  });
  card.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      completeTutorialInteraction();
    }
  });
}

function completeTutorialInteraction() {
  if (els.tutorialPlayground.dataset.complete === "true") return;
  els.tutorialPlayground.dataset.complete = "true";
  if (state.tutorialStep === 0) {
    const card = els.tutorialPlayground.querySelector(".tutorial-reel-shell");
    card?.classList.add("is-swiped");
    setTimeout(() => { els.tutorialPlayground.innerHTML = `<div class="tutorial-point-pop">+1 POINT</div>`; }, 230);
    revealTutorialNext(420);
  } else if (state.tutorialStep === 1) {
    const heart = els.tutorialPlayground.querySelector(".tutorial-heart");
    heart.classList.add("is-liked");
    heart.querySelector(".action-icon").textContent = "♥";
    heart.querySelector(".action-count").textContent = "24.8K";
    heart.setAttribute("aria-pressed", "true");
    revealTutorialNext(420);
  } else {
    const wheel = els.tutorialPlayground.querySelector(".tutorial-wheel-demo");
    wheel.classList.add("is-spinning");
    wheel.disabled = true;
    setTimeout(() => {
      els.tutorialPlayground.innerHTML = `<div class="tutorial-bonus-facts">
        <div><strong>Every 10–20 scrolls:</strong> roulette or market betting</div>
        <div><strong>Every 50 scrolls:</strong> a guaranteed free prize wheel</div>
        <div><strong>Always:</strong> climb the global leaderboard</div>
      </div>`;
    }, 950);
    revealTutorialNext(1150);
  }
}

function revealTutorialNext(delay) {
  setTimeout(() => {
    els.tutorialNext.hidden = false;
    els.tutorialNext.textContent = state.tutorialStep === TUTORIAL_STEPS.length - 1 ? "Start scrolling →" : "Next lesson →";
    els.tutorialNext.classList.add("is-ready");
    els.tutorialNext.focus();
  }, delay);
}

function closeTutorial() {
  els.tutorial.classList.remove("is-open");
  els.tutorial.setAttribute("aria-hidden", "true");
  els.app.setAttribute("aria-hidden", "false");
  document.body.classList.remove("roulette-locked");
  setTimeout(() => {
    els.feed.focus({ preventScroll: true });
    state.activeReel?.querySelector(".meme-media")?.play().catch(() => {});
  }, 280);
}

function enterApp(showTutorial = false) {
  els.onboarding.hidden = true;
  els.app.setAttribute("aria-hidden", "false");
  updateScore(); renderLeaderboard(); refreshLeaderboard();
  if (!state.leaderboardUnsubscribe) {
    state.leaderboardUnsubscribe = backend.subscribeToLeaderboard(() => refreshLeaderboard());
  }
  if (!els.feed.children.length) appendReelBatch();
  if (showTutorial) setTimeout(openTutorial, 100);
  else if (state.user.prizeWheelPending) setTimeout(openPrizeWheel, 100);
  else if (state.user.marketPending) setTimeout(openMarket, 100);
  else if (state.user.roulettePending) setTimeout(openRoulette, 100);
  else setTimeout(() => els.feed.focus({ preventScroll: true }), 100);
}

els.onboardingForm.addEventListener("submit", async event => {
  event.preventDefault();
  const username = els.usernameInput.value.trim().replace(/^@/, "");
  if (!/^[A-Za-z0-9_]{2,18}$/.test(username)) {
    els.usernameError.textContent = "Use 2–18 letters, numbers, or underscores.";
    els.usernameInput.focus(); return;
  }
  const submit = els.onboardingForm.querySelector("button[type='submit']");
  submit.disabled = true;
  submit.textContent = "Claiming username…";
  try {
    const avatarUrl = state.authSession?.user?.user_metadata?.avatar_url || null;
    applyRemoteState(await backend.claimUsername(username, avatarUrl));
    enterApp(true);
  } catch (error) {
    els.usernameError.textContent = error.message || "Couldn’t save that username.";
    els.usernameInput.focus();
  } finally {
    submit.disabled = false;
    submit.innerHTML = `Start scrolling <span aria-hidden="true">→</span>`;
  }
});

els.usernameInput.addEventListener("input", () => { els.usernameError.textContent = ""; });
els.leaderboardButton.addEventListener("click", event => openLeaderboard(event.currentTarget));
els.mobileLeaderboardButton.addEventListener("click", event => openLeaderboard(event.currentTarget));
els.leaderboardTabs.addEventListener("click", event => {
  const button = event.target.closest("button[data-board]");
  if (!button) return;
  state.leaderboardMode = button.dataset.board;
  renderLeaderboard();
});
els.closeLeaderboard.addEventListener("click", closeLeaderboard);
els.panelBackdrop.addEventListener("click", closeLeaderboard);
els.betOptions.addEventListener("click", event => {
  const button = event.target.closest(".bet-button");
  if (button) selectBet(button.dataset.bet);
});
els.rouletteStakeOptions.addEventListener("click", event => {
  const button = event.target.closest("button[data-stake]");
  if (button) selectRouletteStake(Number(button.dataset.stake));
});
els.rouletteSpin.addEventListener("click", spinRoulette);
els.rouletteContinue.addEventListener("click", completeRoulette);
els.predictionOptions.addEventListener("click", event => {
  const button = event.target.closest(".prediction-button");
  if (!button || state.marketResolving || state.user.market) return;
  state.selectedPrediction = button.dataset.prediction;
  updateMarketSubmit();
});
els.stakeOptions.addEventListener("click", event => {
  const button = event.target.closest("button[data-stake]");
  if (!button || state.marketResolving || state.user.market) return;
  state.selectedStakeRatio = Number(button.dataset.stake);
  updateMarketSubmit();
});
els.marketSubmit.addEventListener("click", resolveMarket);
els.marketContinue.addEventListener("click", completeMarket);
els.prizeSpin.addEventListener("click", spinPrizeWheel);
els.prizeContinue.addEventListener("click", completePrizeWheel);
els.tutorialSkip.addEventListener("click", closeTutorial);
els.tutorialNext.addEventListener("click", () => {
  if (state.tutorialStep < TUTORIAL_STEPS.length - 1) {
    state.tutorialStep += 1;
    renderTutorialStep();
  } else {
    closeTutorial();
  }
});

async function finishAnonymousSession(session) {
  state.authSession = session;
  state.remoteUserId = session.user.id;
  const remote = await backend.getState();
  if (remote?.username) {
    applyRemoteState(remote);
    enterApp();
    return;
  }
  els.onboardingForm.hidden = false;
  setTimeout(() => els.usernameInput.focus(), 100);
}

document.addEventListener("keydown", event => {
  if (!els.onboarding.hidden) return;
  trapModalFocus(event);
  if (els.tutorial.classList.contains("is-open")) {
    if (event.key === "Escape") closeTutorial();
    return;
  }
  if (els.prizeGate.classList.contains("is-open") || els.marketGate.classList.contains("is-open") || els.rouletteGate.classList.contains("is-open")) {
    if (event.key === "Escape") event.preventDefault();
    return;
  }
  if (event.key === "Escape") { closeLeaderboard(); return; }
  if (els.leaderboardPanel.classList.contains("is-open")) return;
  if (["ArrowDown", "PageDown", "j", "J"].includes(event.key)) { event.preventDefault(); scrollReel(1); }
  if (["ArrowUp", "PageUp", "k", "K"].includes(event.key)) { event.preventDefault(); scrollReel(-1); }
  if (event.key === " " && state.activeReel) { event.preventDefault(); handleMemeTap(state.activeReel); }
  if ((event.key === "l" || event.key === "L") && state.activeReel) toggleLike(state.activeReel);
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden) document.querySelectorAll(".meme-media").forEach(media => media.pause());
  else if (state.activeReel) state.activeReel.querySelector(".meme-media").play().catch(() => {});
});

if (REELS.length === 0) {
  els.feed.innerHTML = `<div class="feed-empty"><div><strong>Nothing to watch yet</strong>Fresh reels will appear here soon.</div></div>`;
}

async function bootstrap() {
  els.app.setAttribute("aria-hidden", "true");
  els.onboardingForm.hidden = true;
  if (!backend?.available) {
    els.usernameError.textContent = "BetterIG couldn’t connect. Refresh and try again.";
    els.onboardingForm.hidden = false;
    els.onboardingForm.querySelector("button[type='submit']").disabled = true;
    return;
  }
  try {
    state.authSession = await backend.getSession();
    if (!state.authSession) {
      state.authSession = await backend.signInAnonymously();
    }
    await finishAnonymousSession(state.authSession);
  } catch (error) {
    els.onboardingForm.hidden = false;
    els.usernameError.textContent = /anonymous/i.test(error.message || "")
      ? "Anonymous access needs to be enabled in Supabase."
      : "Couldn’t connect to BetterIG. Refresh and try again.";
    els.onboardingForm.querySelector("button[type='submit']").disabled = true;
  }
}

bootstrap();
