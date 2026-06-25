const FEED = document.querySelector("#paperFeed");
const TEMPLATE = document.querySelector("#paperCardTemplate");
const STATUS_LABEL = document.querySelector("#statusLabel");
const STATUS_DETAIL = document.querySelector("#statusDetail");
const TOPIC_INPUT = document.querySelector("#topicInput");
const QUICK_FILTERS = document.querySelector("#quickFilters");
const CATEGORY_SELECT = document.querySelector("#categorySelect");
const CATEGORY_LABEL = document.querySelector("#categoryLabel");
const DATE_SELECT = document.querySelector("#dateSelect");
const SORT_SELECT = document.querySelector("#sortSelect");
const REFRESH_BUTTON = document.querySelector("#refreshButton");
const SOURCE_COUNTS = document.querySelector("#sourceCounts");
const LOAD_MORE_BUTTON = document.querySelector("#loadMoreButton");
const LOAD_MORE_NOTE = document.querySelector("#loadMoreNote");
const SAVED_TOGGLE = document.querySelector("#savedToggle");
const SAVED_COUNT = document.querySelector("#savedCount");
const SAVED_PANEL = document.querySelector("#savedPanel");
const PANEL_SAVED_COUNT = document.querySelector("#panelSavedCount");
const SAVED_LIST = document.querySelector("#savedList");
const CLOSE_SAVED_BUTTON = document.querySelector("#closeSavedButton");
const AUTH_STATUS = document.querySelector("#authStatus");
const HEADER_SIGN_IN_BUTTON = document.querySelector("#headerSignInButton");
const SIGN_IN_BUTTON = document.querySelector("#signInButton");
const SIGN_OUT_BUTTON = document.querySelector("#signOutButton");
const SYNC_NOTE = document.querySelector("#syncNote");
const DETAIL_PANEL = document.querySelector("#detailPanel");
const DETAIL_BACKDROP = document.querySelector("#detailBackdrop");
const DETAIL_CLOSE_BUTTON = document.querySelector("#detailCloseButton");
const DETAIL_SOURCE = document.querySelector("#detailSource");
const DETAIL_DATE = document.querySelector("#detailDate");
const DETAIL_TITLE = document.querySelector("#detailTitle");
const DETAIL_AUTHORS = document.querySelector("#detailAuthors");
const DETAIL_JOURNAL = document.querySelector("#detailJournal");
const DETAIL_BADGES = document.querySelector("#detailBadges");
const DETAIL_ABSTRACT = document.querySelector("#detailAbstract");
const DETAIL_SAVE_BUTTON = document.querySelector("#detailSaveButton");
const DETAIL_SHARE_BUTTON = document.querySelector("#detailShareButton");
const DETAIL_OPEN_LINK = document.querySelector("#detailOpenLink");
const ONBOARDING_PANEL = document.querySelector("#onboardingPanel");
const ONBOARDING_BACKDROP = document.querySelector("#onboardingBackdrop");
const SKIP_ONBOARDING_BUTTON = document.querySelector("#skipOnboardingButton");
const START_BROWSING_BUTTON = document.querySelector("#startBrowsingButton");
const INTEREST_CHOICES = document.querySelector("#interestChoices");
const MIX_CHOICES = document.querySelector("#mixChoices");

const legacySavedKey = "paperscroll:saved";
const legacyHiddenKey = "paperscroll:hidden";
const legacyOnboardingKey = "paperscroll:onboarding";
const FEED_BATCH_SIZE = 8;
const ONBOARDING_VERSION = 3;
const savedKey = "paprfeed:saved";
const hiddenKey = "paprfeed:hidden";
const onboardingKey = "paprfeed:onboarding";
const cacheKeyPrefix = "paprfeed:v59:last-feed";
const pubMedFilterMap = {
  all: "all",
  published: "all",
  reviews: "review[Publication Type]",
  clinical: "clinical trial[Publication Type]",
  free: "free full text[sb]",
};

const sourceSettings = {
  all: {
    label: "All sources",
    defaultTopic: "",
    categoryLabel: "Field",
    categories: [
      ["auto", "Auto"],
      ["ai", "AI/ML"],
      ["medicine", "Medicine"],
      ["biology", "Biology"],
      ["neuroscience", "Neuroscience"],
      ["genomics", "Genomics"],
      ["public-health", "Public health"],
    ],
  },
  arxiv: {
    label: "arXiv",
    defaultTopic: "machine learning",
    categoryLabel: "Field",
    categories: [
      ["cs.LG", "Machine Learning"],
      ["cs.AI", "Artificial Intelligence"],
      ["cs.CV", "Computer Vision"],
      ["q-bio.NC", "Neurons and Cognition"],
      ["stat.ML", "Statistics ML"],
    ],
  },
  biorxiv: {
    label: "bioRxiv",
    defaultTopic: "genomics",
    categoryLabel: "Field",
    categories: [
      ["bioinformatics", "Bioinformatics"],
      ["genomics", "Genomics"],
      ["neuroscience", "Neuroscience"],
      ["immunology", "Immunology"],
      ["cell_biology", "Cell Biology"],
    ],
  },
  medrxiv: {
    label: "medRxiv",
    defaultTopic: "clinical research",
    categoryLabel: "Field",
    categories: [
      ["epidemiology", "Epidemiology"],
      ["cardiovascular medicine", "Cardiovascular"],
      ["public and global health", "Public Health"],
      ["neurology", "Neurology"],
      ["infectious diseases", "Infectious Diseases"],
    ],
  },
  pubmed: {
    label: "PubMed",
    defaultTopic: "cancer immunotherapy",
    categoryLabel: "Type",
    categories: [
      ["all", "All PubMed"],
      ["clinical trial[Publication Type]", "Clinical Trials"],
      ["review[Publication Type]", "Reviews"],
      ["systematic review[Publication Type]", "Systematic Reviews"],
      ["free full text[sb]", "Free Full Text"],
    ],
  },
};

let activeSource = "all";
let activeQuickFilter = "all";
let onboardingTopic = "";
let onboardingField = "auto";
let onboardingFilter = "all";
let papers = [];
let sourceCounts = {};
let sourceOffsets = {};
let allSourceOverflow = [];
let currentDetailPaper = null;
let canLoadMore = true;
let isLoadingMore = false;
let latestRequestId = 0;
let emptyFeedMessage = "";
let supabaseClient = null;
let authUser = null;
let authReady = false;
let isSyncingSaved = false;

function migrateLocalStorageKey(oldKey, newKey) {
  if (localStorage.getItem(newKey) || !localStorage.getItem(oldKey)) return;
  localStorage.setItem(newKey, localStorage.getItem(oldKey));
}

migrateLocalStorageKey(legacySavedKey, savedKey);
migrateLocalStorageKey(legacyHiddenKey, hiddenKey);
migrateLocalStorageKey(legacyOnboardingKey, onboardingKey);

function getSaved() {
  try {
    return JSON.parse(localStorage.getItem(savedKey)) ?? [];
  } catch {
    return [];
  }
}

function setSaved(items) {
  localStorage.setItem(savedKey, JSON.stringify(items));
}

function mergeSavedPapers(localItems, remoteItems) {
  const merged = new Map();
  [...remoteItems, ...localItems].forEach((paper) => {
    if (!paper?.id) return;
    merged.set(paper.id, paper);
  });
  return [...merged.values()].slice(0, 120);
}

function getHidden() {
  try {
    return JSON.parse(localStorage.getItem(hiddenKey)) ?? [];
  } catch {
    return [];
  }
}

function setHidden(ids) {
  localStorage.setItem(hiddenKey, JSON.stringify(ids));
}

function getOnboarding() {
  try {
    return JSON.parse(localStorage.getItem(onboardingKey));
  } catch {
    return null;
  }
}

function setOnboarding(settings) {
  localStorage.setItem(onboardingKey, JSON.stringify(settings));
}

function isSaved(id) {
  return getSaved().some((paper) => paper.id === id);
}

function isHidden(id) {
  return getHidden().includes(id);
}

function toggleSaved(paper) {
  const saved = getSaved();
  const exists = saved.some((item) => item.id === paper.id);
  const next = exists ? saved.filter((item) => item.id !== paper.id) : [paper, ...saved].slice(0, 60);
  setSaved(next);
  syncSavedChange(paper, exists ? "remove" : "add");
  renderFeed();
  renderSaved();
}

function removeSavedPaper(paper) {
  if (!isSaved(paper.id)) return;
  setSaved(getSaved().filter((item) => item.id !== paper.id));
  syncSavedChange(paper, "remove");
  renderFeed();
  renderSaved();
  updateDetailSaveButton();
  setStatus("Removed from saved", paper.title);
}

function hidePaper(paper) {
  const hidden = new Set(getHidden());
  hidden.add(paper.id);
  setHidden([...hidden]);
  papers = papers.filter((item) => item.id !== paper.id);
  if (currentDetailPaper?.id === paper.id) closeDetail();
  setStatus("Hidden", "That paper is hidden on this device.");
  renderFeed();
}

function resetHiddenPapers() {
  setHidden([]);
  setStatus("Hidden reset", "Hidden papers can appear again after refresh.");
  loadFeed();
}

function showOnboarding() {
  const current = getOnboarding();
  const validCurrent = current?.version === ONBOARDING_VERSION ? current : null;
  onboardingTopic = validCurrent?.topic ?? TOPIC_INPUT.value ?? "";
  onboardingField = validCurrent?.field ?? CATEGORY_SELECT.value ?? "auto";
  onboardingFilter = validCurrent?.filter ?? activeQuickFilter;
  INTEREST_CHOICES.querySelectorAll(".choice-card").forEach((choice) => {
    choice.classList.toggle("active", choice.dataset.field === onboardingField);
  });
  MIX_CHOICES.querySelectorAll(".choice-card").forEach((choice) => {
    choice.classList.toggle("active", choice.dataset.filter === onboardingFilter);
  });
  ONBOARDING_PANEL.classList.remove("hidden");
  document.body.classList.add("detail-open");
}

function closeOnboarding() {
  ONBOARDING_PANEL.classList.add("hidden");
  document.body.classList.remove("detail-open");
}

function selectChoice(container, button) {
  container.querySelectorAll(".choice-card").forEach((choice) => {
    choice.classList.toggle("active", choice === button);
  });
}

function applyOnboardingSettings(settings) {
  activateSource("all");
  setCategories("all");
  setActiveQuickFilter(settings.filter ?? "all");
  TOPIC_INPUT.value = settings.mode === "latest" ? "" : (settings.topic ?? sourceSettings.all.defaultTopic);
  CATEGORY_SELECT.value = settings.field ?? "auto";
  SORT_SELECT.value = settings.sort ?? "newest";
}

function latestFeedSettings() {
  return { topic: "", field: "auto", filter: "all", mode: "latest", sort: "newest" };
}

function completeOnboarding(settings) {
  const nextSettings = {
    completed: true,
    version: ONBOARDING_VERSION,
    topic: settings.topic ?? onboardingTopic,
    field: settings.field ?? onboardingField,
    filter: settings.filter ?? onboardingFilter,
    mode: settings.mode ?? "personalized",
    sort: settings.sort ?? "newest",
    completedAt: new Date().toISOString(),
  };
  setOnboarding(nextSettings);
  applyOnboardingSettings(nextSettings);
  closeOnboarding();
  loadFeed();
}

function setStatus(label, detail) {
  STATUS_LABEL.textContent = label;
  STATUS_DETAIL.textContent = detail;
}

function setSyncNote(message = "") {
  SYNC_NOTE.textContent = message;
  SYNC_NOTE.classList.toggle("hidden", !message);
}

function userLabel(user) {
  return user?.email || user?.user_metadata?.full_name || "Signed in";
}

function updateAuthUi() {
  const configured = Boolean(supabaseClient);
  HEADER_SIGN_IN_BUTTON.classList.toggle("hidden", !configured || Boolean(authUser));
  SIGN_IN_BUTTON.classList.toggle("hidden", !configured || Boolean(authUser));
  SIGN_OUT_BUTTON.classList.toggle("hidden", !configured || !authUser);
  AUTH_STATUS.classList.toggle("hidden", !configured || !authUser);
  AUTH_STATUS.textContent = authUser ? userLabel(authUser) : "";

  if (!configured) {
    setSyncNote("");
    return;
  }

  setSyncNote(
    authUser
      ? "Signed in. Saved papers sync across your devices."
      : "Sign in with Google to sync saved papers across devices.",
  );
}

function cloudRowsFromSaved(items) {
  if (!authUser) return [];
  return items.map((paper) => ({
    user_id: authUser.id,
    paper_id: paper.id,
    paper_json: paper,
    saved_at: new Date().toISOString(),
  }));
}

async function loadCloudSaved() {
  if (!supabaseClient || !authUser) return [];
  const { data, error } = await supabaseClient
    .from("saved_papers")
    .select("paper_json,saved_at")
    .order("saved_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map((row) => row.paper_json).filter(Boolean);
}

async function uploadSavedToCloud(items) {
  if (!supabaseClient || !authUser || !items.length) return;
  const { error } = await supabaseClient.from("saved_papers").upsert(cloudRowsFromSaved(items), {
    onConflict: "user_id,paper_id",
  });
  if (error) throw error;
}

async function syncSavedChange(paper, action) {
  if (!supabaseClient || !authUser || isSyncingSaved) return;

  try {
    if (action === "remove") {
      const { error } = await supabaseClient.from("saved_papers").delete().eq("paper_id", paper.id);
      if (error) throw error;
      return;
    }

    await uploadSavedToCloud([paper]);
  } catch {
    setSyncNote("Saved locally. Cloud sync will retry after sign in or refresh.");
  }
}

async function syncSavedAfterSignIn() {
  if (!supabaseClient || !authUser || isSyncingSaved) return;
  isSyncingSaved = true;
  setSyncNote("Syncing saved papers...");

  try {
    const localSaved = getSaved();
    await uploadSavedToCloud(localSaved);
    const remoteSaved = await loadCloudSaved();
    setSaved(mergeSavedPapers(localSaved, remoteSaved));
    renderFeed();
    renderSaved();
    setSyncNote("Signed in. Saved papers sync across your devices.");
  } catch {
    setSyncNote("Signed in, but saved papers could not sync yet.");
  } finally {
    isSyncingSaved = false;
  }
}

async function signInWithGoogle() {
  if (!supabaseClient) return;
  const { error } = await supabaseClient.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin + window.location.pathname,
    },
  });
  if (error) setSyncNote("Google sign-in could not start. Check Supabase setup.");
}

async function signOut() {
  if (!supabaseClient) return;
  await supabaseClient.auth.signOut();
}

async function initAuth() {
  try {
    const { SUPABASE_ANON_KEY, SUPABASE_URL } = await import("./supabase-config.js");

    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      updateAuthUi();
      return;
    }

    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm");
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data } = await supabaseClient.auth.getSession();
    authUser = data.session?.user ?? null;
    authReady = true;
    updateAuthUi();
    if (authUser) syncSavedAfterSignIn();

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      authUser = session?.user ?? null;
      updateAuthUi();
      if (authUser) syncSavedAfterSignIn();
      renderFeed();
      renderSaved();
    });
  } catch {
    authReady = false;
    updateAuthUi();
  }
}

function resetPaging() {
  sourceOffsets = {
    arxiv: 0,
    biorxiv: 0,
    medrxiv: 0,
    pubmed: 0,
  };
  allSourceOverflow = [];
  canLoadMore = true;
}

function setCategories(source) {
  CATEGORY_SELECT.replaceChildren();
  CATEGORY_LABEL.textContent = sourceSettings[source].categoryLabel;
  sourceSettings[source].categories.forEach(([value, label]) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    CATEGORY_SELECT.append(option);
  });
}

function cleanText(value) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();
}

function normalizeSearchText(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/[‐‑‒–—−]/g, "-");
}

function queryTerms(topic) {
  const text = normalizeSearchText(topic);
  if (!text || text.length < 2) return [];

  const quoted = [...text.matchAll(/"([^"]+)"/g)].map((match) => match[1]).filter(Boolean);
  const withoutQuoted = text.replace(/"[^"]+"/g, " ");
  const words = withoutQuoted
    .split(/[^a-z0-9-]+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 1 && !["and", "or", "the", "with", "for"].includes(term));

  return [...new Set([...quoted, ...words])];
}

function significantQueryTerms(topic) {
  return queryTerms(topic).filter((term) => term.length >= 3 || /[0-9-]/.test(term));
}

function termVariants(term) {
  const variants = [term];
  if (term.includes("-")) variants.push(term.replace(/-/g, " "));
  if (/^car-?t$/.test(term)) {
    variants.push(
      "car t-cell",
      "car-t cell",
      "car t cells",
      "car-t cells",
      "chimeric antigen receptor",
      "chimeric antigen receptor t",
      "chimeric antigen receptor t-cell",
    );
  }
  return [...new Set(variants)];
}

function searchablePaperText(paper) {
  return normalizeSearchText([paper.title, paper.abstract, paper.journal, paper.authors, paper.sourceLabel].join(" "));
}

function paperMatchesTopic(paper, topic) {
  const terms = significantQueryTerms(topic);
  if (!terms.length) return true;
  const text = searchablePaperText(paper);
  return terms.every((term) => termVariants(term).some((variant) => text.includes(variant)));
}

function filterTopicMatches(items, topic) {
  return items.filter((paper) => paperMatchesTopic(paper, topic));
}

function pubMedTermForTopic(topic) {
  const terms = queryTerms(topic);
  if (!terms.length) return cleanText(topic);
  return terms
    .map((term) => {
      const variants = pubMedTermVariants(term);
      return variants.length > 1 ? `(${variants.join(" OR ")})` : variants[0];
    })
    .join(" AND ");
}

function pubMedTermVariants(term) {
  if (/^car-?t$/.test(term)) {
    return [
      '"CAR-T"[All Fields]',
      '"CAR T"[All Fields]',
      '"CAR-T cells"[All Fields]',
      '"CAR T cells"[All Fields]',
      '"chimeric antigen receptor"[Title/Abstract]',
    ];
  }

  return termVariants(term).map((variant) => `"${variant}"[Title/Abstract]`);
}

function isBroadCartTopic(topic) {
  const terms = queryTerms(topic);
  return terms.length === 1 && /^car-?t$/.test(terms[0]);
}

function arxivTermForTopic(topic) {
  const terms = queryTerms(topic);
  if (!terms.length) return `all:${encodeURIComponent(cleanText(topic))}`;
  return terms.map((term) => `all:${encodeURIComponent(term)}`).join("+AND+");
}

function searchRelevanceScore(paper, topic) {
  const terms = significantQueryTerms(topic);
  if (!terms.length) return 0;

  const title = normalizeSearchText(paper.title);
  const abstract = normalizeSearchText(paper.abstract);
  const allText = searchablePaperText(paper);
  const exactTopic = normalizeSearchText(topic).replace(/^"|"$/g, "");
  let score = 0;

  if (exactTopic && title.includes(exactTopic)) score += 14;
  if (exactTopic && abstract.includes(exactTopic)) score += 8;

  terms.forEach((term) => {
    const variants = termVariants(term);
    if (variants.some((variant) => title.includes(variant))) score += 5;
    if (variants.some((variant) => abstract.includes(variant))) score += 2;
    if (variants.some((variant) => allText.includes(variant))) score += 1;
  });

  return score;
}

function truncate(value, length = 430) {
  const text = cleanText(value);
  if (text.length <= length) return text;
  return `${text.slice(0, length).trim()}...`;
}

function formatDate(value) {
  if (!value) return "No date";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return cleanText(value);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function dateValue(value) {
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 0 : date.valueOf();
}

function getDateRange(days) {
  const end = new Date();
  const start = new Date();
  start.setDate(end.getDate() - Number(days));
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

function filterBySelectedDateRange(papers) {
  const { start, end } = getDateRange(DATE_SELECT.value);
  const startMs = new Date(`${start}T00:00:00Z`).valueOf();
  const endMs = new Date(`${end}T23:59:59Z`).valueOf();

  return papers.filter((paper) => {
    const value = dateValue(paper.date);
    return value >= startMs && value <= endMs;
  });
}

async function fetchWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? 7000);
  const requestUrl = proxiedUrl(url);

  try {
    return await fetch(requestUrl, {
      ...options,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function proxiedUrl(url) {
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1" ||
    window.location.protocol === "file:";

  if (isLocal) return url;
  return `/api/proxy?url=${encodeURIComponent(url)}`;
}

function mergeUnique(existing, incoming) {
  const seen = new Set(existing.map((paper) => paper.id));
  return [...existing, ...incoming.filter((paper) => !seen.has(paper.id))];
}

function updateOffsets(items) {
  items.forEach((paper) => {
    if (paper.source === "biorxiv" || paper.source === "medrxiv") return;
    if (sourceOffsets[paper.source] !== undefined) sourceOffsets[paper.source] += 1;
  });
}

function updateSourceCounts() {
  sourceCounts = papers.reduce((counts, paper) => {
    counts[paper.sourceLabel] = (counts[paper.sourceLabel] ?? 0) + 1;
    return counts;
  }, {});
}

function renderSourceCounts() {
  SOURCE_COUNTS.replaceChildren();

  Object.entries(sourceCounts).forEach(([label, count]) => {
    const item = document.createElement("span");
    item.className = "count-pill";
    item.textContent = `${label} ${count}`;
    SOURCE_COUNTS.append(item);
  });

  const hiddenCount = getHidden().length;
  if (hiddenCount) {
    const resetButton = document.createElement("button");
    resetButton.className = "count-pill reset-hidden-button";
    resetButton.type = "button";
    resetButton.textContent = `Hidden ${hiddenCount} · Reset`;
    resetButton.addEventListener("click", resetHiddenPapers);
    SOURCE_COUNTS.append(resetButton);
  }
}

function updateLoadMoreButton() {
  LOAD_MORE_BUTTON.classList.toggle("hidden", !papers.length);
  LOAD_MORE_NOTE.classList.toggle("hidden", !papers.length);
  LOAD_MORE_BUTTON.disabled = !canLoadMore || isLoadingMore;
  LOAD_MORE_BUTTON.textContent = isLoadingMore ? "Loading..." : canLoadMore ? "Load more" : "No more papers";

  if (!papers.length) {
    LOAD_MORE_NOTE.textContent = "";
    return;
  }

  const countLabel = papers.length === 1 ? "paper" : "papers";
  const nextBatchText = canLoadMore
    ? activeSource === "all"
      ? `Load more fetches up to ${FEED_BATCH_SIZE} more papers.`
      : `Load more fetches up to ${FEED_BATCH_SIZE} more ${sourceSettings[activeSource].label} papers.`
    : "No more papers are available in the current batch.";
  LOAD_MORE_NOTE.textContent = `Showing ${papers.length} ${countLabel}. ${nextBatchText}`;
}

function paperBadges(paper) {
  const badges = new Set(paper.badges ?? []);
  if (paper.source === "arxiv") {
    badges.add("PDF");
    badges.add("Preprint");
  }
  if (paper.source === "biorxiv" || paper.source === "medrxiv") {
    badges.add("Preprint");
    badges.add("DOI");
  }
  if (paper.source === "pubmed") {
    badges.add("Published");
    if (paper.pmcid) badges.add("Full text");
    if ((paper.publicationTypes ?? []).some((type) => type.toLowerCase().includes("review"))) badges.add("Review");
    if ((paper.publicationTypes ?? []).some((type) => type.toLowerCase().includes("clinical trial"))) {
      badges.add("Clinical trial");
    }
  }
  return [...badges];
}

function renderBadges(container, paper) {
  container.replaceChildren();
  paperBadges(paper).forEach((label) => {
    const badge = document.createElement("span");
    badge.className = "paper-badge";
    badge.textContent = label;
    container.append(badge);
  });
  container.classList.toggle("hidden", !container.children.length);
}

function removeHidden(items) {
  const hidden = new Set(getHidden());
  return items.filter((paper) => !hidden.has(paper.id));
}

function setActiveQuickFilter(filter) {
  activeQuickFilter = filter;
  QUICK_FILTERS.querySelectorAll(".filter-chip").forEach((button) => {
    button.classList.toggle("active", button.dataset.filter === filter);
  });
}

function activateSource(source) {
  activeSource = source;
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.source === source);
  });
}

function isPubMedFilter(filter) {
  return ["published", "reviews", "clinical", "free"].includes(filter);
}

function pubMedTypeFilter() {
  return pubMedFilterMap[activeQuickFilter] ?? "all";
}

function selectedFieldLabel() {
  return CATEGORY_SELECT.selectedOptions[0]?.textContent ?? "Auto";
}

function feedDescription(source) {
  const topic = cleanText(TOPIC_INPUT.value);
  if (!topic && source === "all") return "Newest papers. Field: Any.";
  if (!topic) return `Newest papers. ${sourceSettings[source].categoryLabel}: ${selectedFieldLabel()}.`;
  if (source === "all") {
    const field = CATEGORY_SELECT.value;
    const fieldText = field === "auto" ? "Any" : selectedFieldLabel();
    return `Topic: ${topic}. Field: ${fieldText}.`;
  }
  return `Topic: ${topic}. ${sourceSettings[source].categoryLabel}: ${selectedFieldLabel()}.`;
}

function fieldLabel(field) {
  const labels = {
    ai: "AI/ML",
    medicine: "Medicine",
    biology: "Biology",
    neuroscience: "Neuroscience",
    genomics: "Genomics",
    "public-health": "Public health",
  };
  return labels[field] ?? "Any";
}

function sortPapers(items) {
  const next = [...items];
  const topic = cleanText(TOPIC_INPUT.value);
  const relevance = (paper) => searchRelevanceScore(paper, topic);

  if (SORT_SELECT.value === "oldest") {
    return next.sort((a, b) => dateValue(a.date) - dateValue(b.date) || relevance(b) - relevance(a));
  }
  if (SORT_SELECT.value === "source") {
    return next.sort((a, b) => {
      const bySource = a.sourceLabel.localeCompare(b.sourceLabel);
      return bySource || dateValue(b.date) - dateValue(a.date) || relevance(b) - relevance(a);
    });
  }
  return next.sort((a, b) => dateValue(b.date) - dateValue(a.date) || relevance(b) - relevance(a));
}

function renderFeed() {
  FEED.replaceChildren();
  updateSourceCounts();
  renderSourceCounts();
  updateLoadMoreButton();

  if (!papers.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = emptyFeedMessage || "No papers found yet. Try another topic, source, or date range.";
    FEED.append(empty);
    return;
  }

  papers.forEach((paper) => {
    const node = TEMPLATE.content.firstElementChild.cloneNode(true);
    const sourcePill = node.querySelector(".source-pill");
    const saveButton = node.querySelector(".save-button");
    const hideButton = node.querySelector(".hide-button");
    const detailsButton = node.querySelector(".details-button");
    const shareButton = node.querySelector(".share-button");
    const citeButton = node.querySelector(".cite-button");
    const openLink = node.querySelector(".open-link");

    sourcePill.textContent = paper.sourceLabel;
    sourcePill.classList.add(paper.source);
    node.querySelector(".paper-date").textContent = formatDate(paper.date);
    node.querySelector("h2").textContent = paper.title;
    node.querySelector(".authors").textContent = paper.authors || "Authors not listed";
    const journal = node.querySelector(".journal");
    journal.textContent = paper.journal ? paper.journal : "";
    journal.classList.toggle("hidden", !paper.journal);
    renderBadges(node.querySelector(".paper-badges"), paper);
    node.querySelector(".abstract").textContent = truncate(paper.abstract);
    openLink.href = paper.url;

    if (isSaved(paper.id)) {
      node.classList.add("is-saved");
      saveButton.classList.add("saved");
      saveButton.lastChild.textContent = " Saved";
    }

    saveButton.addEventListener("click", () => toggleSaved(paper));
    hideButton.addEventListener("click", () => hidePaper(paper));
    detailsButton.addEventListener("click", () => openDetail(paper));
    shareButton.addEventListener("click", () => sharePaper(paper));
    citeButton.addEventListener("click", () => copyCitation(paper, citeButton));
    FEED.append(node);
  });
}

function renderSaved() {
  const saved = getSaved();
  const count = saved.length;
  SAVED_COUNT.textContent = count;
  PANEL_SAVED_COUNT.textContent = count;
  SAVED_TOGGLE.setAttribute("aria-label", `Saved papers, ${count} saved`);
  SAVED_LIST.replaceChildren();

  if (!saved.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Saved papers will appear here.";
    SAVED_LIST.append(empty);
    return;
  }

  saved.forEach((paper) => {
    const shell = document.createElement("div");
    shell.className = "saved-item-shell";

    const item = document.createElement("div");
    item.className = "saved-item";

    const text = document.createElement("div");
    text.className = "saved-item-text";

    const link = document.createElement("a");
    link.href = paper.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = paper.title;

    const meta = document.createElement("span");
    meta.textContent = [paper.sourceLabel, paper.journal, formatDate(paper.date)].filter(Boolean).join(" · ");

    const removeButton = document.createElement("button");
    removeButton.className = "saved-remove-button";
    removeButton.type = "button";
    removeButton.title = "Remove saved paper";
    removeButton.setAttribute("aria-label", `Remove ${paper.title} from saved papers`);
    removeButton.innerHTML = `
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M19 6l-1 14H6L5 6" />
        <path d="M10 11v5M14 11v5" />
      </svg>
      <span>Remove</span>
    `;
    removeButton.addEventListener("click", () => removeSavedPaper(paper));

    text.append(link, meta);
    item.append(text);
    shell.append(item, removeButton);
    enableSavedItemSwipe(shell, item);
    SAVED_LIST.append(shell);
  });
}

function enableSavedItemSwipe(shell, item) {
  let startX = 0;
  let startY = 0;
  let currentX = 0;
  let tracking = false;
  let horizontal = false;

  const settle = (open) => {
    shell.classList.toggle("swipe-open", open);
    item.style.transform = "";
  };

  item.addEventListener("pointerdown", (event) => {
    const isTouchPointer = event.pointerType === "touch" || event.pointerType === "pen";
    if (!isTouchPointer && !window.matchMedia("(max-width: 430px)").matches) return;
    document.querySelectorAll(".saved-item-shell.swipe-open").forEach((openItem) => {
      if (openItem !== shell) openItem.classList.remove("swipe-open");
    });
    tracking = true;
    horizontal = false;
    startX = event.clientX;
    startY = event.clientY;
    currentX = shell.classList.contains("swipe-open") ? -88 : 0;
    item.setPointerCapture(event.pointerId);
  });

  item.addEventListener("pointermove", (event) => {
    if (!tracking) return;
    const deltaX = event.clientX - startX;
    const deltaY = event.clientY - startY;
    if (!horizontal && Math.abs(deltaX) < 8 && Math.abs(deltaY) < 8) return;
    if (!horizontal && Math.abs(deltaY) >= Math.abs(deltaX)) {
      tracking = false;
      return;
    }
    horizontal = true;
    const origin = shell.classList.contains("swipe-open") ? -88 : 0;
    currentX = Math.max(-88, Math.min(0, origin + deltaX));
    item.style.transform = `translateX(${currentX}px)`;
  });

  const finishSwipe = () => {
    if (!tracking) return;
    tracking = false;
    settle(horizontal ? currentX < -44 : shell.classList.contains("swipe-open"));
  };

  item.addEventListener("pointerup", finishSwipe);
  item.addEventListener("pointercancel", finishSwipe);
}

async function sharePaper(paper) {
  const shareData = {
    title: paper.title,
    text: `${paper.title}\n${[paper.sourceLabel, paper.journal].filter(Boolean).join(" · ")}`,
    url: paper.url,
  };

  try {
    if (navigator.share) {
      await navigator.share(shareData);
      setStatus("Shared", "The paper was sent to your share sheet.");
      return;
    }

    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(paper.url);
      setStatus("Copied", "The paper link was copied to your clipboard.");
      return;
    }
  } catch {
    return;
  }

  setStatus("Share link", paper.url);
}

function citationForPaper(paper) {
  const authors = cleanText(paper.authors) || "Authors not listed";
  const parsedDate = new Date(paper.date);
  const year = Number.isNaN(parsedDate.valueOf()) ? "n.d." : parsedDate.getFullYear();
  const title = cleanText(paper.title);
  const punctuatedTitle = /[.!?]$/.test(title) ? title : `${title}.`;
  const publication = cleanText(paper.journal || paper.sourceLabel);
  const identifier = paper.doi ? `https://doi.org/${paper.doi}` : paper.url;

  return `${authors} (${year}). ${punctuatedTitle} ${publication}. ${identifier}`;
}

async function writeToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through for browsers that expose Clipboard API but deny access.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard copy failed");
}

async function copyCitation(paper, button) {
  const label = button.querySelector("span");

  try {
    await writeToClipboard(citationForPaper(paper));
    button.classList.add("copied");
    label.textContent = "Copied";
    window.setTimeout(() => {
      button.classList.remove("copied");
      label.textContent = "Cite";
    }, 1600);
  } catch {
    label.textContent = "Try again";
    window.setTimeout(() => {
      label.textContent = "Cite";
    }, 1600);
  }
}

function openDetail(paper) {
  currentDetailPaper = paper;
  DETAIL_SOURCE.textContent = paper.sourceLabel;
  DETAIL_SOURCE.className = `source-pill ${paper.source}`;
  DETAIL_DATE.textContent = formatDate(paper.date);
  DETAIL_TITLE.textContent = paper.title;
  DETAIL_AUTHORS.textContent = paper.authors || "Authors not listed";
  DETAIL_JOURNAL.textContent = paper.journal || "";
  DETAIL_JOURNAL.classList.toggle("hidden", !paper.journal);
  renderBadges(DETAIL_BADGES, paper);
  DETAIL_ABSTRACT.textContent = paper.abstract;
  DETAIL_OPEN_LINK.href = paper.url;
  updateDetailSaveButton();
  DETAIL_PANEL.classList.remove("hidden");
  document.body.classList.add("detail-open");
}

function closeDetail() {
  DETAIL_PANEL.classList.add("hidden");
  document.body.classList.remove("detail-open");
  currentDetailPaper = null;
}

function updateDetailSaveButton() {
  if (!currentDetailPaper) return;
  const saved = isSaved(currentDetailPaper.id);
  DETAIL_SAVE_BUTTON.classList.toggle("saved", saved);
  DETAIL_SAVE_BUTTON.lastChild.textContent = saved ? " Saved" : " Save";
}

function feedCacheKey(source, topic = TOPIC_INPUT.value) {
  return [
    cacheKeyPrefix,
    source,
    activeQuickFilter,
    cleanText(topic) || "latest",
    CATEGORY_SELECT.value || "auto",
    DATE_SELECT.value || "30",
  ].join(":");
}

function cacheFeed(source, topic, items) {
  localStorage.setItem(
    feedCacheKey(source, topic),
    JSON.stringify({
      source,
      filter: activeQuickFilter,
      topic: cleanText(topic),
      category: CATEGORY_SELECT.value,
      range: DATE_SELECT.value,
      items,
      savedAt: new Date().toISOString(),
    }),
  );
}

function loadCachedFeed(source, topic = TOPIC_INPUT.value) {
  try {
    return JSON.parse(localStorage.getItem(feedCacheKey(source, topic)));
  } catch {
    return null;
  }
}

function parseArxiv(xmlText) {
  const xml = new DOMParser().parseFromString(xmlText, "application/xml");
  return [...xml.querySelectorAll("entry")].map((entry) => {
    const idUrl = cleanText(entry.querySelector("id")?.textContent);
    const pdfLink =
      [...entry.querySelectorAll("link")].find((link) => link.getAttribute("title") === "pdf") ??
      entry.querySelector("link");

    return {
      id: idUrl,
      source: "arxiv",
      sourceLabel: "arXiv",
      title: cleanText(entry.querySelector("title")?.textContent),
      authors: [...entry.querySelectorAll("author name")]
        .slice(0, 5)
        .map((author) => cleanText(author.textContent))
        .join(", "),
      abstract: cleanText(entry.querySelector("summary")?.textContent),
      date: cleanText(entry.querySelector("published")?.textContent),
      url: pdfLink?.getAttribute("href") ?? idUrl,
    };
  });
}

async function fetchArxiv(options = {}) {
  const topic = cleanText(options.topic ?? TOPIC_INPUT.value);
  const category = options.category ?? CATEGORY_SELECT.value;
  const maxResults = options.maxResults ?? FEED_BATCH_SIZE;
  const start = options.start ?? sourceOffsets.arxiv ?? 0;
  const categoryTerm = category && category !== "auto" ? `cat:${category}` : "";
  const topicTerm = topic ? arxivTermForTopic(topic) : "";
  const query = [categoryTerm, topicTerm].filter(Boolean).join("+AND+") || "all:*";
  const url = `https://export.arxiv.org/api/query?search_query=${query}&start=${start}&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;
  const response = await fetchWithTimeout(url, { timeoutMs: options.timeoutMs });
  if (!response.ok) throw new Error("arXiv request failed");
  return filterBySelectedDateRange(filterTopicMatches(parseArxiv(await response.text()), topic));
}

async function fetchBioRxivLike(source, options = {}) {
  const { start, end } = getDateRange(DATE_SELECT.value);
  const category = cleanText(options.category ?? CATEGORY_SELECT.value);
  const maxResults = options.maxResults ?? FEED_BATCH_SIZE;
  let cursor = options.cursor ?? sourceOffsets[source] ?? 0;
  const apiSource = source === "medrxiv" ? "medrxiv" : "biorxiv";
  const categoryQuery = category && category !== "auto" ? `?category=${encodeURIComponent(category)}` : "";
  const topic = cleanText(options.topic ?? TOPIC_INPUT.value);
  const fetchPage = async (pageCursor) => {
    const url = `https://api.biorxiv.org/details/${apiSource}/${start}/${end}/${pageCursor}${categoryQuery}`;
    const response = await fetchWithTimeout(url, { timeoutMs: options.timeoutMs ?? 3500 });
    if (!response.ok) throw new Error(`${sourceSettings[source].label} request failed`);
    return response.json();
  };
  const normalizePapers = (data) =>
    (data.collection ?? []).map((paper) => ({
      id: `${source}:${paper.doi}`,
      source,
      sourceLabel: sourceSettings[source].label,
      title: cleanText(paper.title),
      authors: cleanText(paper.authors),
      journal: source === "medrxiv" ? "medRxiv preprint" : "bioRxiv preprint",
      abstract: cleanText(paper.abstract),
      date: paper.date,
      url: `https://doi.org/${paper.doi}`,
    }));

  let data = await fetchPage(cursor);
  const pageSize = Number(data.messages?.[0]?.count) || maxResults || 30;

  if (SORT_SELECT.value === "newest" && cursor === 0) {
    const total = Number(data.messages?.[0]?.total) || 0;
    const newestCursor = Math.max(0, total - pageSize);
    if (newestCursor > 0) {
      cursor = newestCursor;
      data = await fetchPage(cursor);
    }
  }

  const collected = [];
  let pageCursor = cursor;
  const maxPages = topic ? 4 : 1;

  for (let page = 0; page < maxPages; page += 1) {
    collected.push(...filterTopicMatches(normalizePapers(data), topic));
    if (collected.length >= maxResults || SORT_SELECT.value !== "newest" || pageCursor <= 0) break;
    pageCursor = Math.max(0, pageCursor - pageSize);
    data = await fetchPage(pageCursor);
  }

  sourceOffsets[source] =
    SORT_SELECT.value === "newest" ? Math.max(0, pageCursor - pageSize) : cursor + Number(data.messages?.[0]?.count ?? pageSize);

  return collected.slice(0, maxResults);
}

function parsePubMedMonth(value) {
  const text = cleanText(value).toLowerCase();
  if (!text) return 1;
  const numeric = Number(text);
  if (numeric >= 1 && numeric <= 12) return numeric;
  const months = {
    jan: 1,
    january: 1,
    feb: 2,
    february: 2,
    mar: 3,
    march: 3,
    apr: 4,
    april: 4,
    may: 5,
    jun: 6,
    june: 6,
    jul: 7,
    july: 7,
    aug: 8,
    august: 8,
    sep: 9,
    sept: 9,
    september: 9,
    oct: 10,
    october: 10,
    nov: 11,
    november: 11,
    dec: 12,
    december: 12,
    spring: 3,
    summer: 6,
    fall: 9,
    autumn: 9,
    winter: 12,
  };
  return months[text.slice(0, 3)] ?? months[text] ?? 1;
}

function isoDateFromParts(year, month = "1", day = "1") {
  const parsedYear = Number(cleanText(year));
  if (!parsedYear) return "";
  const parsedMonth = parsePubMedMonth(month);
  const parsedDay = Math.max(1, Math.min(31, Number(cleanText(day)) || 1));
  return `${parsedYear}-${String(parsedMonth).padStart(2, "0")}-${String(parsedDay).padStart(2, "0")}`;
}

function dateFromPubMedNode(node) {
  if (!node) return "";
  return isoDateFromParts(
    node.querySelector("Year")?.textContent,
    node.querySelector("Month")?.textContent,
    node.querySelector("Day")?.textContent,
  );
}

function dateFromMedlineText(value) {
  const text = cleanText(value);
  const match = text.match(/(\d{4})(?:\s+([A-Za-z]+))?/);
  return match ? isoDateFromParts(match[1], match[2] || "1", "1") : "";
}

function parsePubMedDate(article) {
  const candidates = [];
  const addDate = (value) => {
    const date = cleanText(value);
    const timestamp = dateValue(date);
    if (date && timestamp && timestamp <= Date.now() + 86400000) candidates.push(date);
  };

  article.querySelectorAll("ArticleDate").forEach((node) => addDate(dateFromPubMedNode(node)));
  article.querySelectorAll("JournalIssue PubDate").forEach((node) => {
    addDate(dateFromPubMedNode(node));
    addDate(dateFromMedlineText(node.querySelector("MedlineDate")?.textContent));
  });
  article.querySelectorAll("PubMedPubDate").forEach((node) => addDate(dateFromPubMedNode(node)));

  if (!candidates.length) return "";
  return candidates.sort((a, b) => dateValue(b) - dateValue(a))[0];
}

function parsePubMedArticles(xmlText) {
  const xml = new DOMParser().parseFromString(xmlText, "application/xml");

  return [...xml.querySelectorAll("PubmedArticle")].map((article) => {
    const pmid = cleanText(article.querySelector("PMID")?.textContent);
    const title = cleanText(article.querySelector("ArticleTitle")?.textContent);
    const abstract = [...article.querySelectorAll("Abstract AbstractText")]
      .map((section) => {
        const label = cleanText(section.getAttribute("Label"));
        const text = cleanText(section.textContent);
        return label ? `${label}: ${text}` : text;
      })
      .filter(Boolean)
      .join(" ");
    const authors = [...article.querySelectorAll("AuthorList Author")]
      .slice(0, 5)
      .map((author) => {
        const collective = cleanText(author.querySelector("CollectiveName")?.textContent);
        if (collective) return collective;
        const lastName = cleanText(author.querySelector("LastName")?.textContent);
        const initials = cleanText(author.querySelector("Initials")?.textContent);
        const foreName = cleanText(author.querySelector("ForeName")?.textContent);
        return [lastName, initials || foreName].filter(Boolean).join(" ");
      })
      .filter(Boolean)
      .join(", ");
    const journal =
      cleanText(article.querySelector("Journal Title")?.textContent) ||
      cleanText(article.querySelector("Journal ISOAbbreviation")?.textContent);
    const publicationTypes = [...article.querySelectorAll("PublicationTypeList PublicationType")].map((type) =>
      cleanText(type.textContent),
    );
    const articleIds = [...article.querySelectorAll("ArticleIdList ArticleId")].reduce((ids, item) => {
      ids[item.getAttribute("IdType")] = cleanText(item.textContent);
      return ids;
    }, {});

    return {
      id: `pubmed:${pmid}`,
      source: "pubmed",
      sourceLabel: "PubMed",
      title,
      authors,
      journal,
      doi: articleIds.doi,
      pmcid: articleIds.pmc,
      publicationTypes,
      abstract: abstract || "No abstract was included in the PubMed record for this paper.",
      date: parsePubMedDate(article),
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
    };
  });
}

async function fetchPubMed(options = {}) {
  const topic = cleanText(options.topic ?? TOPIC_INPUT.value);
  const typeFilter = options.typeFilter ?? CATEGORY_SELECT.value;
  const fieldFilter = typeFilter === "all" ? "" : ` AND ${typeFilter}`;
  const days = DATE_SELECT.value;
  const maxResults = options.maxResults ?? FEED_BATCH_SIZE;
  let start = options.start ?? sourceOffsets.pubmed ?? 0;
  const topicTerm = topic ? pubMedTermForTopic(topic) : "all[sb]";
  const term = encodeURIComponent(`${topicTerm}${fieldFilter}`);
  const collected = [];
  let attempts = 0;

  while (collected.length < maxResults && attempts < 4) {
    const requestSize = Math.max(maxResults - collected.length, maxResults);
    const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${term}&retmode=json&retstart=${start}&retmax=${requestSize}&sort=pub+date&reldate=${days}&datetype=edat`;
    const searchResponse = await fetchWithTimeout(searchUrl);
    if (!searchResponse.ok) throw new Error("PubMed search failed");
    const searchData = await searchResponse.json();
    const ids = searchData.esearchresult?.idlist ?? [];
    if (!ids.length) break;

    const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids.join(",")}&retmode=xml`;
    const fetchResponse = await fetchWithTimeout(fetchUrl);
    if (!fetchResponse.ok) throw new Error("PubMed records failed");
    const nextItems = filterTopicMatches(parsePubMedArticles(await fetchResponse.text()), topic);
    mergeUnique(collected, nextItems).forEach((paper) => {
      if (collected.length < maxResults && !collected.some((item) => item.id === paper.id)) collected.push(paper);
    });

    if (ids.length < requestSize) break;
    start += requestSize;
    attempts += 1;
  }

  return collected.slice(0, maxResults);
}

function inferredField(topic, selectedField = "auto") {
  if (selectedField && selectedField !== "auto") return selectedField;
  const text = topic.toLowerCase();
  if (/\b(car-?t|cancer|tumou?r|oncology|immunotherapy|clinical|therapy|vaccine|patient|disease)\b/.test(text)) {
    return "medicine";
  }
  if (/\b(genom|gene|crispr|rna|dna|single-cell|transcriptom)\b/.test(text)) return "genomics";
  if (/\b(neurosci\w*|neuro\w*|brain|cognition|neuron\w*|synapse\w*)\b/.test(text)) return "neuroscience";
  if (/\b(epidemiology|public health|population|pandemic|infection|infectious)\b/.test(text)) return "public-health";
  if (
    /\b(cell|protein|biology|molecular|microbiome|enzyme|flow cytometry|cytometry|facs|antibody|assay|western blot|elisa|microscopy|organoid|immunology|immune|lymphocyte|macrophage|t cell|b cell)\b/.test(
      text,
    )
  ) {
    return "biology";
  }
  if (/\b(machine learning|deep learning|ai|llm|robot|vision|transformer|neural network)\b/.test(text)) return "ai";
  return "ai";
}

function sourceDefaultsForTopic(topic, selectedField = "auto") {
  const field = inferredField(topic, selectedField);
  return {
    field,
    arxiv:
      field === "neuroscience"
        ? "q-bio.NC"
        : field === "biology" || field === "genomics" || field === "medicine"
          ? "q-bio.QM"
          : "cs.LG",
    biorxiv:
      field === "neuroscience"
        ? "neuroscience"
        : field === "medicine"
          ? "immunology"
          : field === "biology"
            ? "cell_biology"
            : field === "public-health"
              ? "epidemiology"
              : "genomics",
    medrxiv:
      field === "neuroscience"
        ? "neurology"
        : field === "medicine" || field === "biology" || field === "genomics"
          ? "oncology"
          : field === "public-health"
            ? "public and global health"
            : "public and global health",
  };
}

async function fetchAllSources(options = {}) {
  const queued = allSourceOverflow.splice(0, FEED_BATCH_SIZE);
  if (queued.length === FEED_BATCH_SIZE) return queued;

  const topic = cleanText(TOPIC_INPUT.value);
  const selectedField = CATEGORY_SELECT.value;
  const defaults = topic && selectedField !== "auto"
    ? sourceDefaultsForTopic(topic, selectedField)
    : { field: "auto", arxiv: "", biorxiv: "", medrxiv: "" };
  const baseBatchPlan = options.batchPlan ?? allSourceBatchPlan();
  const pubMedTopicDepth = isBroadCartTopic(topic) ? FEED_BATCH_SIZE * 10 : FEED_BATCH_SIZE * 5;
  const batchPlan =
    topic && baseBatchPlan.pubmed
      ? { ...baseBatchPlan, pubmed: Math.max(baseBatchPlan.pubmed, pubMedTopicDepth) }
      : baseBatchPlan;
  const tasks = [];
  const candidateLimit = options.candidateLimit ?? Math.max(FEED_BATCH_SIZE, Object.values(batchPlan).reduce((sum, count) => sum + count, 0));

  if (!isPubMedFilter(activeQuickFilter)) {
    if (batchPlan.arxiv) {
      tasks.push(fetchArxiv({ topic, category: defaults.arxiv, maxResults: batchPlan.arxiv, start: sourceOffsets.arxiv, timeoutMs: 3500 }));
    }
    if (batchPlan.biorxiv) {
      tasks.push(fetchBioRxivLike("biorxiv", { topic, category: defaults.biorxiv, maxResults: batchPlan.biorxiv, cursor: sourceOffsets.biorxiv }));
    }
    if (batchPlan.medrxiv) {
      tasks.push(fetchBioRxivLike("medrxiv", { topic, category: defaults.medrxiv, maxResults: batchPlan.medrxiv, cursor: sourceOffsets.medrxiv }));
    }
  }

  if (batchPlan.pubmed) {
    tasks.push(fetchPubMed({ topic, typeFilter: pubMedTypeFilter(), maxResults: batchPlan.pubmed, start: sourceOffsets.pubmed }));
  }

  const requests = await Promise.allSettled(tasks);
  let items = mergeUnique(queued, requests.flatMap((request) => (request.status === "fulfilled" ? request.value : [])));

  if (batchPlan.pubmed && isBroadCartTopic(topic) && items.length) {
    for (const targetTopic of ["bcma car-t", "cd19 car-t"]) {
      try {
        items = mergeUnique(
          items,
          await fetchPubMed({ topic: targetTopic, typeFilter: pubMedTypeFilter(), maxResults: 4, start: 0 }),
        );
      } catch {
        // Target-specific CAR-T expansion is helpful but should never block the broad feed.
      }
    }
  }

  if (batchPlan.arxiv) sourceOffsets.arxiv = (sourceOffsets.arxiv ?? 0) + batchPlan.arxiv;
  if (batchPlan.pubmed) sourceOffsets.pubmed = (sourceOffsets.pubmed ?? 0) + batchPlan.pubmed;

  if (batchPlan.pubmed && items.length < candidateLimit) {
    let pubmedStart = sourceOffsets.pubmed ?? batchPlan.pubmed;
    let attempts = 0;

    while (items.length < candidateLimit && attempts < 3) {
      const needed = candidateLimit - items.length;
      let extraPubMed = [];

      try {
        extraPubMed = await fetchPubMed({
          topic,
          typeFilter: pubMedTypeFilter(),
          maxResults: needed,
          start: pubmedStart,
        });
      } catch {
        break;
      }

      if (!extraPubMed.length) break;
      items = mergeUnique(items, extraPubMed);
      pubmedStart += needed;
      sourceOffsets.pubmed = Math.max(sourceOffsets.pubmed ?? 0, pubmedStart);
      attempts += 1;
    }
  }

  if (!items.length) throw new Error("All sources failed");
  const sortedItems = sortPapers(items);
  allSourceOverflow = mergeUnique(allSourceOverflow, sortedItems.slice(FEED_BATCH_SIZE));
  return sortedItems.slice(0, FEED_BATCH_SIZE);
}

function allSourceBatchPlan() {
  if (isPubMedFilter(activeQuickFilter)) {
    return { arxiv: 0, biorxiv: 0, medrxiv: 0, pubmed: FEED_BATCH_SIZE * 3 };
  }
  if (activeQuickFilter === "preprints") {
    return { arxiv: FEED_BATCH_SIZE, biorxiv: FEED_BATCH_SIZE, medrxiv: FEED_BATCH_SIZE, pubmed: 0 };
  }
  return {
    arxiv: FEED_BATCH_SIZE,
    biorxiv: FEED_BATCH_SIZE,
    medrxiv: FEED_BATCH_SIZE,
    pubmed: FEED_BATCH_SIZE,
  };
}

async function loadFeed() {
  const requestId = ++latestRequestId;
  const source = activeSource;
  const label = sourceSettings[source].label;
  resetPaging();
  emptyFeedMessage = "";
  setStatus("Loading", `Fetching ${label}. ${feedDescription(source)}`);
  FEED.replaceChildren();
  SOURCE_COUNTS.replaceChildren();
  LOAD_MORE_BUTTON.classList.add("hidden");
  LOAD_MORE_NOTE.classList.add("hidden");

  try {
    let nextPapers = [];
    if (source === "all") nextPapers = await fetchAllSources();
    if (source === "arxiv") nextPapers = await fetchArxiv();
    if (source === "biorxiv" || source === "medrxiv") nextPapers = await fetchBioRxivLike(source, { topic: TOPIC_INPUT.value });
    if (source === "pubmed") nextPapers = await fetchPubMed({ typeFilter: pubMedTypeFilter() });
    if (requestId !== latestRequestId) return;

    if (source !== "all") updateOffsets(nextPapers);
    papers = sortPapers(removeHidden(nextPapers));
    canLoadMore = nextPapers.length > 0;

    cacheFeed(source, TOPIC_INPUT.value, papers);
    setStatus("Live Feed", `${papers.length} papers loaded from ${label}. ${feedDescription(source)}`);
  } catch (error) {
    if (requestId !== latestRequestId) return;
    const cached = loadCachedFeed(source);
    papers = sortPapers(cached?.items?.length ? removeHidden(cached.items) : []);
    canLoadMore = false;
    if (papers.length) {
      setStatus("Cached Feed", `${label} could not load live results. Showing your last successful results.`);
    } else {
      emptyFeedMessage = "Could not load live papers right now. Try refresh, another topic, or another source.";
      setStatus("Could not load", `${label} could not load live results right now.`);
    }
  }

  renderFeed();
}

async function loadMore() {
  if (isLoadingMore || !canLoadMore) return;

  const requestId = ++latestRequestId;
  const source = activeSource;
  const label = sourceSettings[source].label;
  const scrollBeforeLoad = window.scrollY;
  isLoadingMore = true;
  updateLoadMoreButton();
  setStatus("Loading more", `Fetching the next papers from ${label}. ${feedDescription(source)}`);

  try {
    let nextPapers = [];
    if (source === "all") nextPapers = await fetchAllSources();
    if (source === "arxiv") nextPapers = await fetchArxiv();
    if (source === "biorxiv" || source === "medrxiv") nextPapers = await fetchBioRxivLike(source, { topic: TOPIC_INPUT.value });
    if (source === "pubmed") nextPapers = await fetchPubMed({ typeFilter: pubMedTypeFilter() });
    if (requestId !== latestRequestId) return;

    if (source !== "all") updateOffsets(nextPapers);
    const merged = mergeUnique(papers, removeHidden(nextPapers));
    canLoadMore = nextPapers.length > 0 && merged.length > papers.length;
    papers = sortPapers(merged);

    cacheFeed(source, TOPIC_INPUT.value, papers);
    setStatus("Live Feed", `${papers.length} papers loaded from ${label}. ${feedDescription(source)}`);
  } catch (error) {
    if (requestId !== latestRequestId) return;
    canLoadMore = false;
    setStatus("Load paused", `Could not load more from ${label}. Try refresh or another filter.`);
  } finally {
    if (requestId === latestRequestId) {
      isLoadingMore = false;
      renderFeed();
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      requestAnimationFrame(() => window.scrollTo({ top: scrollBeforeLoad, left: 0, behavior: "auto" }));
    }
  }
}

function switchSource(source) {
  if (source === "pubmed" && activeQuickFilter === "preprints") setActiveQuickFilter("published");
  if (["arxiv", "biorxiv", "medrxiv"].includes(source) && isPubMedFilter(activeQuickFilter)) setActiveQuickFilter("all");
  activateSource(source);
  setCategories(source);
  TOPIC_INPUT.value = sourceSettings[source].defaultTopic;
  loadFeed();
}

function applyQuickFilter(filter) {
  setActiveQuickFilter(filter);

  if (filter === "preprints" && activeSource === "pubmed") {
    activateSource("all");
    setCategories("all");
    TOPIC_INPUT.value = sourceSettings.all.defaultTopic;
  }

  if (isPubMedFilter(filter) && !["all", "pubmed"].includes(activeSource)) {
    activateSource("all");
    setCategories("all");
    TOPIC_INPUT.value = sourceSettings.all.defaultTopic;
  }

  loadFeed();
}

function debounce(callback, delay = 500) {
  let timeoutId;
  return (...args) => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => callback(...args), delay);
  };
}

function loadFeedFromTopicInput() {
  const topic = cleanText(TOPIC_INPUT.value);
  if (topic.length === 1) {
    setStatus("Keep typing", "Add a little more detail before searching.");
    return;
  }
  loadFeed();
}

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => switchSource(tab.dataset.source));
});

QUICK_FILTERS.querySelectorAll(".filter-chip").forEach((button) => {
  button.addEventListener("click", () => applyQuickFilter(button.dataset.filter));
});

TOPIC_INPUT.addEventListener("input", debounce(loadFeedFromTopicInput, 900));
CATEGORY_SELECT.addEventListener("change", () => {
  loadFeed();
});
DATE_SELECT.addEventListener("change", loadFeed);
SORT_SELECT.addEventListener("change", () => {
  papers = sortPapers(papers);
  renderFeed();
});
REFRESH_BUTTON.addEventListener("click", loadFeed);
LOAD_MORE_BUTTON.addEventListener("click", loadMore);

document.querySelectorAll(".suggested-topic-button").forEach((button) => {
  button.addEventListener("click", () => {
    TOPIC_INPUT.value = button.dataset.topic || "";
    loadFeedFromTopicInput();
  });
});

SAVED_TOGGLE.addEventListener("click", () => {
  SAVED_PANEL.classList.toggle("hidden");
  renderSaved();
});

CLOSE_SAVED_BUTTON.addEventListener("click", () => {
  SAVED_PANEL.classList.add("hidden");
});

SIGN_IN_BUTTON.addEventListener("click", signInWithGoogle);
HEADER_SIGN_IN_BUTTON.addEventListener("click", signInWithGoogle);
SIGN_OUT_BUTTON.addEventListener("click", signOut);

DETAIL_CLOSE_BUTTON.addEventListener("click", closeDetail);
DETAIL_BACKDROP.addEventListener("click", closeDetail);
DETAIL_SAVE_BUTTON.addEventListener("click", () => {
  if (!currentDetailPaper) return;
  toggleSaved(currentDetailPaper);
  updateDetailSaveButton();
});

DETAIL_SHARE_BUTTON.addEventListener("click", () => {
  if (!currentDetailPaper) return;
  sharePaper(currentDetailPaper);
});

INTEREST_CHOICES.querySelectorAll(".choice-card").forEach((button) => {
  button.addEventListener("click", () => {
    onboardingTopic = button.dataset.topic;
    onboardingField = button.dataset.field;
    selectChoice(INTEREST_CHOICES, button);
  });
});

MIX_CHOICES.querySelectorAll(".choice-card").forEach((button) => {
  button.addEventListener("click", () => {
    onboardingFilter = button.dataset.filter;
    selectChoice(MIX_CHOICES, button);
  });
});

START_BROWSING_BUTTON.addEventListener("click", () => {
  completeOnboarding({
    topic: onboardingTopic,
    field: onboardingField,
    filter: onboardingFilter,
    mode: "personalized",
    sort: "newest",
  });
});

SKIP_ONBOARDING_BUTTON.addEventListener("click", () => {
  completeOnboarding(latestFeedSettings());
});

ONBOARDING_BACKDROP.addEventListener("click", () => {
  completeOnboarding(latestFeedSettings());
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !ONBOARDING_PANEL.classList.contains("hidden")) {
    completeOnboarding(latestFeedSettings());
    return;
  }
  if (event.key === "Escape" && !DETAIL_PANEL.classList.contains("hidden")) closeDetail();
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js").then((registration) => registration.update());
}

resetPaging();
setCategories(activeSource);
renderSaved();
initAuth();
const onboarding = getOnboarding();
if (onboarding?.completed && onboarding.version === ONBOARDING_VERSION) {
  applyOnboardingSettings(onboarding);
  loadFeed();
} else {
  showOnboarding();
}
