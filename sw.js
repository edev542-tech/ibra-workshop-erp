const CACHE_NAME='ibra-erp-shell-v1';
const APP_SHELL=["./", "./index.html", "./manifest.webmanifest", "./css/main.css", "./css/login.css", "./css/print.css", "./css/mobile-app.css", "./data/seed.js", "./js/auth.js", "./js/ui.js", "./js/core.js", "./js/modules/production.js", "./js/modules/machines.js", "./js/modules/accounting.js", "./js/modules/fraud.js", "./js/modules/invoices.js", "./js/modules/notifications.js", "./js/modules/projects.js", "./js/modules/permissions.js", "./js/modules/vouchers.js", "./js/modules/customers.js", "./js/modules/employees.js", "./js/modules/payroll.js", "./js/modules/dashboard.js", "./js/modules/quotes.js", "./js/modules/smart.js", "./js/modules/settings.js", "./js/modules/costing.js", "./js/modules/pos.js", "./js/modules/reports.js", "./js/modules/inventory.js", "./js/modules/more.js", "./js/modules/cashboxes.js", "./assets/icon.svg", "./assets/icon-192.png", "./assets/icon-512.png"];
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).catch(()=>{}));self.skipWaiting();});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
 const req=event.request;
 if(req.method!=='GET'||new URL(req.url).origin!==location.origin)return;
 event.respondWith(caches.match(req).then(cached=>cached||fetch(req).then(res=>{if(res.ok&&res.type==='basic'){const copy=res.clone();caches.open(CACHE_NAME).then(c=>c.put(req,copy));}return res;}).catch(()=>cached)));
});
