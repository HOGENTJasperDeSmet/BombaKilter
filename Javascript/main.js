import initSqlJs from 'sql.js';
import { registerSW } from 'virtual:pwa-register';
import { debounce, formatVGrade } from './util.js';
import { ClimbStore } from './ClimbStore.js';

const PAGE_SIZE = 15;
let currentPage = 0;
let totalClimbs = 0;
export let db = null;

const listEl = document.getElementById('climb-list');
const infoEl = document.getElementById('page-info');
const nameInput = document.getElementById('filter-name');
const angleInput = document.getElementById('filter-angle');
const diffMinInput = document.getElementById('filter-diff-min');
const diffMaxInput = document.getElementById('filter-diff-max');
const sentinel = document.getElementById('infinite-sentinel');
const spinner = document.getElementById('spinner');

let isFetching = false;

const observer = new IntersectionObserver(handleIntersection, {
  threshold: 0.1
});

registerSW({ immediate: true });
observer.observe(sentinel);

export const databaseReady = (async () => {
  const [SQL, buffer] = await Promise.all([
    initSqlJs({ locateFile: () => `./sql-wasm.wasm` }),
    loadDatabase()
  ]);

  db = new SQL.Database(buffer);

  const countResult = db.exec('SELECT COUNT(*) FROM climbs ');
  totalClimbs = countResult[0].values[0][0];

  console.log("Database initialized and ready.");

  return db;
})();

databaseReady.then(() => {
  updateList();
});

async function loadDatabase() {
  await requestPersistence();

  const DB_URL = './kilter.db';
  const CACHE_NAME = 'kilter-large-db-v1';
  const cache = await caches.open(CACHE_NAME);

  const cachedResponse = await cache.match(DB_URL);
  if (cachedResponse) {
    const buffer = await cachedResponse.arrayBuffer();
    return new Uint8Array(buffer);
  }

  const downloadContainer = document.getElementById('download-container');
  const progressBar = document.getElementById('download-progress-bar');
  const progressText = document.getElementById('download-percent');
  downloadContainer.classList.remove('hidden');
  infoEl.innerText = "Initializing download...";

  const response = await fetch(DB_URL);
  if (!response.ok) throw new Error("Network response was not ok");

  const contentLength = +response.headers.get('Content-Length');
  if (!contentLength) {
    infoEl.innerText = "Downloading (size unknown)...";
  }

  const reader = response.body.getReader();
  let receivedLength = 0;
  let chunks = [];

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    chunks.push(value);
    receivedLength += value.length;

    if (contentLength) {
      const step = (receivedLength / contentLength) * 100;
      progressBar.style.width = `${step}%`;
      progressText.innerText = `${Math.round(step)}%`;
    }
  }

  let chunksAll = new Uint8Array(receivedLength);
  let position = 0;
  for (let chunk of chunks) {
    chunksAll.set(chunk, position);
    position += chunk.length;
  }

  await cache.put(DB_URL, new Response(chunksAll));

  downloadContainer.classList.add('hidden');
  infoEl.innerText = "Database Loaded.";

  return chunksAll;
}

async function requestPersistence() {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    console.log(`Is storage persisted? ${isPersisted}`);
    return isPersisted;
  }
  return false;
}

function handleIntersection(entries) {
  const [entry] = entries;
  const canLoadMore = currentPage * PAGE_SIZE < totalClimbs;

  if (entry.isIntersecting && !isFetching && canLoadMore) {
    currentPage++;
    updateList(true);
  }
};

export function getRouteFromId(id) {
  const dataSql = `SELECT c.id, c.name, cs.angle, c.description, c.setter_username, cs.display_difficulty, c.frames, cs.ascensionist_count, cs.quality_average 
                     FROM climbs c 
                     JOIN climb_stats cs ON c.id = cs.climb_id
                     WHERE c.id = '${id}'
                     ORDER BY cs.ascensionist_count DESC 
                    `;

  const result = db.exec(dataSql);
  ClimbStore.addRoute(result);
}


function updateList(append = false) {
  if (isFetching) return;

  isFetching = true;
  spinner.classList.remove('hidden');

  const offset = currentPage * PAGE_SIZE;
  let conditions = [];
  let params = [];

  if (nameInput.value) { conditions.push("c.name LIKE ?"); params.push(`%${nameInput.value}%`); }
  if (angleInput.value) { conditions.push("cs.angle = ?"); params.push(angleInput.value); }

  const minV = diffMinInput.value;
  const maxV = diffMaxInput.value;
  conditions.push("cs.display_difficulty BETWEEN ? AND ?");
  params.push(minV, maxV);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : "";
  const dataSql = `SELECT c.id, c.name, cs.display_difficulty, c.frames, cs.ascensionist_count 
                     FROM climbs c 
                     JOIN climb_stats cs ON c.id = cs.climb_id 
                     ${whereClause} 
                     ORDER BY cs.ascensionist_count DESC 
                     LIMIT ${PAGE_SIZE} OFFSET ${offset}`;

  const result = db.exec(dataSql, params);

  const mappedRoutes = ClimbStore.setRoutes(result, append);

  renderUI(mappedRoutes, append);

  isFetching = false;
  spinner.classList.add('hidden');
}

const handleFilterChange = debounce(async () => {
  currentPage = 0;
  listEl.innerHTML = "";
  updateList(false);
}, 300);

[nameInput, angleInput, diffMinInput, diffMaxInput].forEach(input => {
  input.addEventListener('input', () => {
    infoEl.innerText = "Searching...";
    handleFilterChange();
  });
});

function renderUI(climbs, append) {
  const listContainer = document.getElementById('climb-list');

  if (!append) {
    listContainer.innerHTML = '';
  }

  if (climbs.length === 0 && !append) {
    listContainer.innerHTML = `
      <div class="py-12 text-center">
        <p class="text-sm text-slate-400 italic">No routes found matching those filters.</p>
      </div>`;
    return;
  }
  const cardsHtml = climbs.map(climb => {
    return `
      <div class="group flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg hover:border-slate-900 hover:shadow-sm transition-all cursor-pointer" 
           onclick="selectRoute('${climb.id}')">
        <div class="space-y-1">
          <h3 class="font-semibold text-sm leading-none text-slate-900 group-hover:text-black">${climb.name}</h3>
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-white">${formatVGrade(climb.display_difficulty)}</span>
            <span class="text-[10px] text-slate-500 font-medium">${climb.ascensionist_count.toLocaleString()} ascents</span>
          </div>
        </div>
        <div class="text-slate-300 group-hover:text-slate-900 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
      </div>
    `;
  }).join('');

  listContainer.insertAdjacentHTML('beforeend', cardsHtml);
}

