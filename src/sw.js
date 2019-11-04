var version = 1;
var isOnline = true;
var cacheName = `vanille-simple-starter-${version}`;

var urlsToCache = {
  default: ["/"]
};

self.addEventListener("install", onInstall);
self.addEventListener("activate", onActivate);
self.addEventListener("message", onMessage);
self.addEventListener("fetch", onFetch);

main().catch(console.error);

// ****************************

async function main() {
  await sendMessage({ statusUpdateRequest: true });
  await cacheFiles();
}

function onInstall() {
  console.log(`Service Worker (v${version}) installed`);
  self.skipWaiting();
}

function onActivate(evt) {
  evt.waitUntil(handleActivation());
}

async function handleActivation() {
  await clearCaches();
  await cacheFiles(/*forceReload=*/ true);
  await clients.claim();
  console.log(`Service Worker (v${version}) activated`);
}

async function clearCaches() {
  var cacheNames = await caches.keys();
  var oldCacheNames = cacheNames.filter(function matchOldCache(cacheName) {
    var [, cacheNameVersion] =
      cacheName.match(/^vanille-simple-starter-(\d+)$/) || [];
    cacheNameVersion =
      cacheNameVersion != null ? Number(cacheNameVersion) : cacheNameVersion;
    return cacheNameVersion > 0 && version !== cacheNameVersion;
  });
  await Promise.all(
    oldCacheNames.map(function deleteCache(cacheName) {
      return caches.delete(cacheName);
    })
  );
}

async function cacheFiles(forceReload = false) {
  var cache = await caches.open(cacheName);

  return Promise.all(
    urlsToCache.default.map(async function requestFile(url) {
      try {
        let res;

        if (!forceReload) {
          res = await cache.match(url);
          if (res) {
            return;
          }
        }

        let fetchOptions = {
          method: "GET",
          cache: "no-store",
          credentials: "omit"
        };
        res = await fetch(url, fetchOptions);
        if (res.ok) {
          return cache.put(url, res);
        }
      } catch (err) {} //eslint-disable-line no-empty
    })
  );
}

async function sendMessage(msg) {
  var allClients = await clients.matchAll({ includeUncontrolled: true });
  return Promise.all(
    allClients.map(function sendTo(client) {
      var chan = new MessageChannel();
      chan.port1.onmessage = onMessage;
      return client.postMessage(msg, [chan.port2]);
    })
  );
}

function onMessage({ data }) {
  if ("statusUpdate" in data) {
    ({ isOnline } = data.statusUpdate);
    console.log(
      `Service Worker (v${version}) status update... isOnline:${isOnline}`
    );
  }
}

function onFetch(evt) {
  evt.respondWith(router(evt.request));
}

async function router(req) {
  var url = new URL(req.url);
  var reqURL = url.pathname;
  var cache = await caches.open(cacheName);

  // request for site's own URL?
  if (url.origin == location.origin) {
    // are we requesting a page?
    if (req.headers.get("Accept").includes("text/html")) {
      let fetchOptions = {
        method: req.method,
        headers: req.headers,
        cache: "no-store"
      };
      let res = await safeRequest(
        reqURL,
        req,
        fetchOptions,
        /*cacheResponse=*/ false,
        /*checkCacheFirst=*/ false,
        /*checkCacheLast=*/ true
      );
      if (res) {
        if (!res.headers.get("X-Not-Found")) {
          await cache.put(reqURL, res.clone());
        } else {
          await cache.delete(reqURL);
        }
        return res;
      }
    }
    // all other files use "cache-first"
    else {
      let fetchOptions = {
        method: req.method,
        headers: req.headers,
        cache: "no-store"
      };
      let res = await safeRequest(
        reqURL,
        req,
        fetchOptions,
        /*cacheResponse=*/ true,
        /*checkCacheFirst=*/ true
      );
      if (res) {
        return res;
      }

      // otherwise, force a network-level 404 response
      return notFoundResponse();
    }
  }
}

async function safeRequest(
  reqURL,
  req,
  options,
  cacheResponse = false,
  checkCacheFirst = false,
  checkCacheLast = false,
  useRequestDirectly = false
) {
  var cache = await caches.open(cacheName);
  var res;

  if (checkCacheFirst) {
    res = await cache.match(reqURL);
    if (res) {
      return res;
    }
  }

  if (isOnline) {
    try {
      if (useRequestDirectly) {
        res = await fetch(req, options);
      } else {
        res = await fetch(req.url, options);
      }

      if (res && (res.ok || res.type == "opaqueredirect")) {
        if (cacheResponse) {
          await cache.put(reqURL, res.clone());
        }
        return res;
      }
    } catch (err) {} //eslint-disable-line no-empty
  }

  if (checkCacheLast) {
    res = await cache.match(reqURL);
    if (res) {
      return res;
    }
  }
}

function notFoundResponse() {
  return new Response("", {
    status: 404,
    statusText: "Not Found"
  });
}
