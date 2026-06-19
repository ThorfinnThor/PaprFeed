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
const CHANGE_INTERESTS_BUTTON = document.querySelector("#changeInterestsButton");
const SAVED_TOGGLE = document.querySelector("#savedToggle");
const SAVED_PANEL = document.querySelector("#savedPanel");
const SAVED_LIST = document.querySelector("#savedList");
const CLOSE_SAVED_BUTTON = document.querySelector("#closeSavedButton");
const AUTH_STATUS = document.querySelector("#authStatus");
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
const savedKey = "paprfeed:saved";
const hiddenKey = "paprfeed:hidden";
const onboardingKey = "paprfeed:onboarding";
const cacheKeyPrefix = "paprfeed:last-feed";
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
    defaultTopic: "machine learning",
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
let onboardingTopic = "machine learning";
let onboardingField = "ai";
let onboardingFilter = "all";
let papers = [];
let sourceCounts = {};
let sourceOffsets = {};
let currentDetailPaper = null;
let canLoadMore = true;
let isLoadingMore = false;
let latestRequestId = 0;
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
  onboardingTopic = current?.topic ?? TOPIC_INPUT.value ?? onboardingTopic;
  onboardingField = current?.field ?? CATEGORY_SELECT.value ?? onboardingField;
  onboardingFilter = current?.filter ?? activeQuickFilter;
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
  TOPIC_INPUT.value = settings.topic ?? sourceSettings.all.defaultTopic;
  CATEGORY_SELECT.value = settings.field ?? "auto";
}

function completeOnboarding(settings) {
  const nextSettings = {
    completed: true,
    topic: settings.topic ?? onboardingTopic,
    field: settings.field ?? onboardingField,
    filter: settings.filter ?? onboardingFilter,
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

    const { createClient } = await import("https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm");
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

function termVariants(term) {
  const variants = [term];
  if (term.includes("-")) variants.push(term.replace(/-/g, " "));
  return [...new Set(variants)];
}

function searchablePaperText(paper) {
  return normalizeSearchText([paper.title, paper.abstract, paper.journal, paper.authors, paper.sourceLabel].join(" "));
}

function paperMatchesTopic(paper, topic) {
  const terms = queryTerms(topic);
  if (terms.length < 2) return true;
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
      const variants = termVariants(term).map((variant) => `"${variant}"[Title/Abstract]`);
      return variants.length > 1 ? `(${variants.join(" OR ")})` : variants[0];
    })
    .join(" AND ");
}

function arxivTermForTopic(topic) {
  const terms = queryTerms(topic);
  if (!terms.length) return `all:${encodeURIComponent(cleanText(topic))}`;
  return terms.map((term) => `all:${encodeURIComponent(term)}`).join("+AND+");
}

function searchRelevanceScore(paper, topic) {
  const terms = queryTerms(topic);
  if (terms.length < 2) return 0;

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
  LOAD_MORE_BUTTON.disabled = !canLoadMore || isLoadingMore;
  LOAD_MORE_BUTTON.textContent = isLoadingMore ? "Loading..." : canLoadMore ? "Load more" : "No more papers";
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
  const topic = cleanText(TOPIC_INPUT.value) || sourceSettings[source].defaultTopic;
  if (source === "all") {
    const field = CATEGORY_SELECT.value;
    const inferred = inferredField(topic, field);
    const fieldText = field === "auto" ? `Auto -> ${fieldLabel(inferred)}` : selectedFieldLabel();
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
  return labels[field] ?? "AI/ML";
}

function sortPapers(items) {
  const next = [...items];
  const topic = cleanText(TOPIC_INPUT.value);
  const relevance = (paper) => searchRelevanceScore(paper, topic);

  if (SORT_SELECT.value === "oldest") {
    return next.sort((a, b) => relevance(b) - relevance(a) || dateValue(a.date) - dateValue(b.date));
  }
  if (SORT_SELECT.value === "source") {
    return next.sort((a, b) => {
      const byRelevance = relevance(b) - relevance(a);
      if (byRelevance) return byRelevance;
      const bySource = a.sourceLabel.localeCompare(b.sourceLabel);
      return bySource || dateValue(b.date) - dateValue(a.date);
    });
  }
  return next.sort((a, b) => relevance(b) - relevance(a) || dateValue(b.date) - dateValue(a.date));
}

function renderFeed() {
  FEED.replaceChildren();
  updateSourceCounts();
  renderSourceCounts();
  updateLoadMoreButton();

  if (!papers.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "No papers found yet. Try another topic, source, or date range.";
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
      saveButton.classList.add("saved");
      saveButton.lastChild.textContent = " Saved";
    }

    saveButton.addEventListener("click", () => toggleSaved(paper));
    hideButton.addEventListener("click", () => hidePaper(paper));
    detailsButton.addEventListener("click", () => openDetail(paper));
    shareButton.addEventListener("click", () => sharePaper(paper));
    FEED.append(node);
  });
}

function renderSaved() {
  const saved = getSaved();
  SAVED_LIST.replaceChildren();

  if (!saved.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Saved papers will appear here.";
    SAVED_LIST.append(empty);
    return;
  }

  saved.forEach((paper) => {
    const item = document.createElement("div");
    item.className = "saved-item";

    const link = document.createElement("a");
    link.href = paper.url;
    link.target = "_blank";
    link.rel = "noreferrer";
    link.textContent = paper.title;

    const meta = document.createElement("span");
    meta.textContent = [paper.sourceLabel, paper.journal, formatDate(paper.date)].filter(Boolean).join(" · ");

    item.append(link, meta);
    SAVED_LIST.append(item);
  });
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

function cacheFeed(source, topic, items) {
  localStorage.setItem(
    `${cacheKeyPrefix}:${source}:${activeQuickFilter}`,
    JSON.stringify({
      source,
      filter: activeQuickFilter,
      topic,
      items,
      savedAt: new Date().toISOString(),
    }),
  );
}

function loadCachedFeed(source) {
  try {
    return JSON.parse(localStorage.getItem(`${cacheKeyPrefix}:${source}:${activeQuickFilter}`));
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
  const topic = cleanText(options.topic ?? TOPIC_INPUT.value) || sourceSettings.arxiv.defaultTopic;
  const category = options.category ?? CATEGORY_SELECT.value;
  const maxResults = options.maxResults ?? 20;
  const start = options.start ?? sourceOffsets.arxiv ?? 0;
  const query = `cat:${category}+AND+${arxivTermForTopic(topic)}`;
  const url = `https://export.arxiv.org/api/query?search_query=${query}&start=${start}&max_results=${maxResults}&sortBy=submittedDate&sortOrder=descending`;
  const response = await fetchWithTimeout(url, { timeoutMs: options.timeoutMs });
  if (!response.ok) throw new Error("arXiv request failed");
  return filterTopicMatches(parseArxiv(await response.text()), topic);
}

async function fetchBioRxivLike(source, options = {}) {
  const { start, end } = getDateRange(DATE_SELECT.value);
  const category = encodeURIComponent(options.category ?? CATEGORY_SELECT.value);
  const maxResults = options.maxResults ?? 25;
  const cursor = options.cursor ?? sourceOffsets[source] ?? 0;
  const apiSource = source === "medrxiv" ? "medrxiv" : "biorxiv";
  const url = `https://api.biorxiv.org/details/${apiSource}/${start}/${end}/${cursor}?category=${category}`;
  const response = await fetchWithTimeout(url);
  if (!response.ok) throw new Error(`${sourceSettings[source].label} request failed`);
  const data = await response.json();

  const topic = cleanText(options.topic ?? TOPIC_INPUT.value);
  const papers = (data.collection ?? []).map((paper) => ({
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

  return filterTopicMatches(papers, topic).slice(0, maxResults);
}

function parsePubMedDate(article) {
  const articleDate = article.querySelector("ArticleDate");
  const pubDate = article.querySelector("JournalIssue PubDate");
  const year = cleanText(articleDate?.querySelector("Year")?.textContent ?? pubDate?.querySelector("Year")?.textContent);
  const month = cleanText(articleDate?.querySelector("Month")?.textContent ?? pubDate?.querySelector("Month")?.textContent);
  const day = cleanText(articleDate?.querySelector("Day")?.textContent ?? pubDate?.querySelector("Day")?.textContent);
  const medlineDate = cleanText(pubDate?.querySelector("MedlineDate")?.textContent);

  if (!year) return medlineDate;
  const parsedMonth = Number(month) || new Date(`${month} 1, 2000`).getMonth() + 1 || 1;
  const parsedDay = Number(day) || 1;
  return `${year}-${String(parsedMonth).padStart(2, "0")}-${String(parsedDay).padStart(2, "0")}`;
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
  const topic = cleanText(options.topic ?? TOPIC_INPUT.value) || sourceSettings.pubmed.defaultTopic;
  const typeFilter = options.typeFilter ?? CATEGORY_SELECT.value;
  const fieldFilter = typeFilter === "all" ? "" : ` AND ${typeFilter}`;
  const days = DATE_SELECT.value;
  const maxResults = options.maxResults ?? 20;
  const start = options.start ?? sourceOffsets.pubmed ?? 0;
  const term = encodeURIComponent(`${pubMedTermForTopic(topic)}${fieldFilter}`);
  const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=${term}&retmode=json&retstart=${start}&retmax=${maxResults}&sort=pub+date&reldate=${days}&datetype=pdat`;
  const searchResponse = await fetchWithTimeout(searchUrl);
  if (!searchResponse.ok) throw new Error("PubMed search failed");
  const searchData = await searchResponse.json();
  const ids = searchData.esearchresult?.idlist ?? [];
  if (!ids.length) return [];

  const fetchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed&id=${ids.join(",")}&retmode=xml`;
  const fetchResponse = await fetchWithTimeout(fetchUrl);
  if (!fetchResponse.ok) throw new Error("PubMed records failed");
  return filterTopicMatches(parsePubMedArticles(await fetchResponse.text()), topic);
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
  if (/\b(cell|protein|biology|molecular|microbiome|enzyme)\b/.test(text)) return "biology";
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
  const topic = cleanText(TOPIC_INPUT.value) || sourceSettings.all.defaultTopic;
  const defaults = sourceDefaultsForTopic(topic, CATEGORY_SELECT.value);
  const maxResults = options.maxResults ?? 8;
  const tasks = [];

  if (!isPubMedFilter(activeQuickFilter)) {
    tasks.push(fetchArxiv({ topic, category: defaults.arxiv, maxResults, start: sourceOffsets.arxiv, timeoutMs: 2500 }));
    tasks.push(fetchBioRxivLike("biorxiv", { topic, category: defaults.biorxiv, maxResults, cursor: sourceOffsets.biorxiv }));
    tasks.push(fetchBioRxivLike("medrxiv", { topic, category: defaults.medrxiv, maxResults, cursor: sourceOffsets.medrxiv }));
  }

  if (activeQuickFilter !== "preprints") {
    tasks.push(fetchPubMed({ topic, typeFilter: pubMedTypeFilter(), maxResults, start: sourceOffsets.pubmed }));
  }

  const requests = await Promise.allSettled(tasks);
  const items = requests.flatMap((request) => (request.status === "fulfilled" ? request.value : []));
  if (!items.length) throw new Error("All sources failed");
  return items;
}

function fallbackPapers(source) {
  const label = sourceSettings[source].label;
  return [
    {
      id: `${source}:demo-1`,
      source,
      sourceLabel: label,
      title: "Live API results could not be loaded in this browser session",
      authors: "PaprFeed demo",
      journal: source === "pubmed" ? "Example journal" : "",
      abstract:
        "This app is wired for real research APIs. If a source blocks direct browser requests, the next step is adding a small free serverless proxy so the same interface can fetch live papers reliably.",
      date: new Date().toISOString(),
      url: "https://www.ncbi.nlm.nih.gov/books/NBK25497/",
    },
    {
      id: `${source}:demo-2`,
      source,
      sourceLabel: label,
      title: "Saved papers work locally on your device",
      authors: "PaprFeed demo",
      journal: "",
      abstract:
        "Tap Save on papers you want to revisit. For the first version, saved papers are stored in your browser so the app stays free and does not need user accounts.",
      date: new Date().toISOString(),
      url: "https://api.biorxiv.org/",
    },
  ];
}

async function loadFeed() {
  const requestId = ++latestRequestId;
  const source = activeSource;
  const label = sourceSettings[source].label;
  resetPaging();
  setStatus("Loading", `Fetching ${label}. ${feedDescription(source)}`);
  FEED.replaceChildren();
  SOURCE_COUNTS.replaceChildren();
  LOAD_MORE_BUTTON.classList.add("hidden");

  try {
    let nextPapers = [];
    if (source === "all") nextPapers = await fetchAllSources();
    if (source === "arxiv") nextPapers = await fetchArxiv();
    if (source === "biorxiv" || source === "medrxiv") nextPapers = await fetchBioRxivLike(source, { topic: TOPIC_INPUT.value });
    if (source === "pubmed") nextPapers = await fetchPubMed({ typeFilter: pubMedTypeFilter() });
    if (requestId !== latestRequestId) return;

    updateOffsets(nextPapers);
    papers = sortPapers(removeHidden(nextPapers));
    canLoadMore = nextPapers.length > 0;

    cacheFeed(source, TOPIC_INPUT.value, papers);
    setStatus("Live Feed", `${papers.length} papers loaded from ${label}. ${feedDescription(source)}`);
  } catch (error) {
    if (requestId !== latestRequestId) return;
    const cached = loadCachedFeed(source);
    papers = cached?.items?.length ? removeHidden(cached.items) : removeHidden(fallbackPapers(source));
    canLoadMore = false;
    setStatus("Offline Preview", `${label} could not load live results. Showing cached or demo papers.`);
  }

  renderFeed();
}

async function loadMore() {
  if (isLoadingMore || !canLoadMore) return;

  const requestId = ++latestRequestId;
  const source = activeSource;
  const label = sourceSettings[source].label;
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

    updateOffsets(nextPapers);
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
CHANGE_INTERESTS_BUTTON.addEventListener("click", showOnboarding);

SAVED_TOGGLE.addEventListener("click", () => {
  SAVED_PANEL.classList.toggle("hidden");
  renderSaved();
});

CLOSE_SAVED_BUTTON.addEventListener("click", () => {
  SAVED_PANEL.classList.add("hidden");
});

SIGN_IN_BUTTON.addEventListener("click", signInWithGoogle);
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
  completeOnboarding({ topic: onboardingTopic, field: onboardingField, filter: onboardingFilter });
});

SKIP_ONBOARDING_BUTTON.addEventListener("click", () => {
  completeOnboarding({ topic: sourceSettings.all.defaultTopic, field: "auto", filter: "all" });
});

ONBOARDING_BACKDROP.addEventListener("click", () => {
  completeOnboarding({ topic: sourceSettings.all.defaultTopic, field: "auto", filter: "all" });
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !ONBOARDING_PANEL.classList.contains("hidden")) {
    completeOnboarding({ topic: sourceSettings.all.defaultTopic, field: "auto", filter: "all" });
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
if (onboarding?.completed) {
  applyOnboardingSettings(onboarding);
  loadFeed();
} else {
  loadFeed();
  showOnboarding();
}
