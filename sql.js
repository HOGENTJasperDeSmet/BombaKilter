import initSqlJs from 'sql.js';

const PAGE_SIZE = 15;
let currentPage = 0;
let totalClimbs = 0;
let db = null;

const listEl = document.getElementById('climb-list');
const infoEl = document.getElementById('page-info');
const pageNumEl = document.getElementById('page-number');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const nameInput = document.getElementById('filter-name');
const angleInput = document.getElementById('filter-angle');
const diffMinInput = document.getElementById('filter-diff-min');
const diffMaxInput = document.getElementById('filter-diff-max');

async function loadDatabase() {
  await requestPersistence();

  const DB_URL = './kilter.db';
  const CACHE_NAME = 'kilter-large-db-v1';
  const cache = await caches.open(CACHE_NAME);

  const cachedResponse = await cache.match(DB_URL);
  if (cachedResponse) {
    console.log("Found DB in Cache.");
    const buffer = await cachedResponse.arrayBuffer();
    return new Uint8Array(buffer);
  }

  // Show the progress bar container
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

  // Combine chunks into a single Uint8Array
  let chunksAll = new Uint8Array(receivedLength);
  let position = 0;
  for (let chunk of chunks) {
    chunksAll.set(chunk, position);
    position += chunk.length;
  }

  // Cache the completed file for next time
  await cache.put(DB_URL, new Response(chunksAll));

  // Hide progress bar and cleanup
  downloadContainer.classList.add('hidden');
  infoEl.innerText = "Database Loaded.";

  return chunksAll;
}
function debounce(func, delay) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), delay);
  };
}

async function requestPersistence() {
  if (navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persist();
    console.log(`Is storage persisted? ${isPersisted}`);
    return isPersisted;
  }
  return false;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function init() {
  const [SQL, buffer] = await Promise.all([
    initSqlJs({ locateFile: file => `./sql-wasm.wasm` }),
    loadDatabase()
  ]);

  db = new SQL.Database(buffer);

  const countResult = db.exec('SELECT COUNT(*) FROM climbs ');
  totalClimbs = countResult[0].values[0][0];

  updateList();
}

let isFetching = false;
const sentinel = document.getElementById('infinite-sentinel');
const spinner = document.getElementById('spinner');

const observer = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting && !isFetching && (currentPage * PAGE_SIZE < totalClimbs)) {
    currentPage++;
    updateList(true);
  }
}, { threshold: 0.1 });

observer.observe(sentinel);

function updateList(append = false) {
  if (isFetching) return;
  debugger;
  isFetching = true;
  spinner.classList.remove('hidden');

  const offset = currentPage * PAGE_SIZE;
  let conditions = [];
  let params = [];

  // Filter Logic (Keep your existing filtering logic here)
  if (nameInput.value) { conditions.push("c.name LIKE ?"); params.push(`%${nameInput.value}%`); }
  if (angleInput.value) { conditions.push("cs.angle = ?"); params.push(angleInput.value); }

  const minV = diffMinInput.value;
  const maxV = diffMaxInput.value;
  conditions.push("cs.display_difficulty BETWEEN ? AND ?");
  params.push(minV, maxV);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : "";

  // Get Data
  const dataSql = `SELECT c.name, cs.display_difficulty, c.frames, cs.ascensionist_count 
                     FROM climbs c 
                     JOIN climb_stats cs ON c.uuid = cs.climb_uuid 
                     ${whereClause} 
                     ORDER BY cs.ascensionist_count DESC 
                     LIMIT ${PAGE_SIZE} OFFSET ${offset}`;

  const result = db.exec(dataSql, params);

  // Render logic
  renderUI(result, append);

  isFetching = false;
  spinner.classList.add('hidden');
}

// Reset when filters change
const handleFilterChange = debounce(async () => {
  currentPage = 0;
  listEl.innerHTML = ""; // Clear list for new search
  updateList(false);
}, 300);

[nameInput, angleInput, diffMinInput, diffMaxInput].forEach(input => {
  input.addEventListener('input', () => {
    infoEl.innerText = "Searching...";
    handleFilterChange();
  });
});



init().catch(err => {
  infoEl.innerText = "Error loading database.";
  console.error(err);
});


function renderUI(result, append) {
  const climbs = result.length > 0 ? result[0].values.map(row => ({
    name: row[0],
    difficulty: row[1],
    frames: row[2],
    ascents: row[3],
    vGrade: formatVGrade(row[1])
  })) : [];

  const baseUrl = "https://grip-connect-kilter-board.vercel.app/";

  const cardsHtml = climbs.map(climb => {
    const routeUrl = `${baseUrl}?route=${encodeURIComponent(climb.frames)}`;
    return `
      <div class="group flex items-center justify-between p-4 bg-white border border-slate-200 rounded-lg hover:border-slate-900 hover:shadow-sm transition-all cursor-pointer" 
           onclick="window.open('${routeUrl}', '_blank')">
        <div class="space-y-1">
          <h3 class="font-semibold text-sm leading-none text-slate-900 group-hover:text-black">${climb.name}</h3>
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-900 text-white">${climb.vGrade}</span>
            <span class="text-[10px] text-slate-500 font-medium">${climb.ascents.toLocaleString()} ascents</span>
          </div>
        </div>
        <div class="text-slate-300 group-hover:text-slate-900 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
        </div>
      </div>
    `;
  }).join('');
  infoEl.innerText = "Ready";
  const listEl = document.getElementById('climb-list');
  if (append) {
    listEl.insertAdjacentHTML('beforeend', cardsHtml);
  } else {
    listEl.innerHTML = cardsHtml;
  }
}



function formatVGrade(floatDifficulty) {
  const gradeMap = {
    10: "V0", 11: "V0",
    12: "V1", 13: "V1",
    14: "V2", 15: "V2",
    16: "V3", 17: "V3",
    18: "V4", 19: "V4",
    20: "V5", 21: "V5",
    22: "V6", 23: "V7",
    24: "V8", 25: "V9",
    26: "V10", 27: "V11",
    28: "V12", 29: "V13",
    30: "V14", 31: "V15", 32: "V16"
  };
  const score = Math.round(floatDifficulty);
  return gradeMap[score] || `V${score - 13}`; // Fallback calculation
}