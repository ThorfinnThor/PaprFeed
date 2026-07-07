const CACHE_NAME = "paprfeed-v90";
const APP_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./supabase-config.js",
  "./about.html",
  "./sources.html",
  "./topics/",
  "./topics/car-t-cell-therapy/",
  "./topics/bcma-car-t/",
  "./topics/cd19-car-t/",
  "./topics/antibody-drug-conjugates/",
  "./topics/flow-cytometry/",
  "./topics/single-cell-rna-sequencing/",
  "./topics/spatial-transcriptomics/",
  "./topics/crispr-gene-editing/",
  "./topics/cancer-immunotherapy/",
  "./topics/ai-in-medicine/",
  "./topics/llms-in-medicine/",
  "./topics/neuroscience/",
  "./topics/microbiome/",
  "./topics/vaccine-research/",
  "./topics/alzheimers-disease/",
  "./topics/parkinsons-disease/",
  "./topics/diabetes/",
  "./topics/obesity/",
  "./topics/cardiovascular-disease/",
  "./topics/infectious-diseases/",
  "./topics/mrna-vaccines/",
  "./topics/immunology/",
  "./topics/tumor-microenvironment/",
  "./topics/proteomics/",
  "./topics/metabolomics/",
  "./topics/cell-therapy/",
  "./topics/gene-therapy/",
  "./topics/organoids/",
  "./topics/drug-discovery/",
  "./topics/clinical-trials/",
  "./topics/public-health/",
  "./topics/epidemiology/",
  "./privacy.html",
  "./manifest.webmanifest",
  "./assets/icon.svg?v=90",
  "./assets/icon-512.png?v=90",
  "./assets/book-logo.svg",
  "./assets/og-paprfeed.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_FILES)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);

  if (requestUrl.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached ?? caches.match("./index.html"))),
  );
});
