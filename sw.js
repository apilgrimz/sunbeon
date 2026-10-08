/* 순번 공평 계산기 서비스워커 — 화면은 온라인이면 새로 받고, 끊기면 저장본을 씁니다 */
const CACHE = 'sunbeon-fair-v2';
const PAGE = './';
const ASSETS = ['./manifest.json', './icon-192.png', './icon-512.png', './vendor/xlsx.full.min.js', './vendor/jspdf.umd.min.js'];
/* Cloudflare Pages는 /index.html을 /로 돌려보낸다(308). 돌려받은 응답을 그대로 저장하면
   오프라인에서 화면을 열 때 브라우저가 거부하므로, 새 응답으로 다시 만들어 저장한다. */
async function plain(r) {
  if (!r.redirected) return r;
  const body = await r.blob();
  return new Response(body, { status: r.status, statusText: r.statusText, headers: r.headers });
}
self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(ASSETS);
    const r = await fetch(PAGE, { cache: 'reload' });
    if (r.ok) await c.put(PAGE, await plain(r));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith('sunbeon-fair-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => {
      if (r.ok) { const copy = r.clone(); plain(copy).then(p => caches.open(CACHE).then(c => c.put(PAGE, p))).catch(() => {}); }
      return r;
    }).catch(() => caches.match(PAGE).then(hit => hit || Response.error())));
    return;
  }
  const mine = url.origin === location.origin;
  const fonts = /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!mine && !fonts) return;
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(r => {
    if (r && (r.ok || r.type === 'opaque') && !r.redirected) { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return r;
  })));
});
