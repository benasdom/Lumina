// CURSOR
const cursor = document.getElementById('cursor');
const ring = document.getElementById('cursor-ring');
let mx = 0, my = 0, rx = 0, ry = 0;
document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; cursor.style.left = mx+'px'; cursor.style.top = my+'px'; });
(function animRing() {
  rx += (mx - rx) * 0.12;
  ry += (my - ry) * 0.12;
  ring.style.left = rx+'px'; ring.style.top = ry+'px';
  requestAnimationFrame(animRing);
})();

// THEME
const themeToggle = document.getElementById('themeToggle');
let theme = localStorage.getItem('lumina-theme') || 'dark';
document.documentElement.setAttribute('data-theme', theme);
themeToggle.addEventListener('click', () => {
  theme = theme === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('lumina-theme', theme);
});

// SCROLL REVEAL (Marcelo-style)
const reveals = document.querySelectorAll('.reveal');
const io = new IntersectionObserver(entries => {
  entries.forEach(e => { if(e.isIntersecting) { e.target.classList.add('visible'); io.unobserve(e.target); } });
}, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
reveals.forEach(el => io.observe(el));

// STYLE CHIPS
document.getElementById('styleChips').addEventListener('click', e => {
  const chip = e.target.closest('.style-chip');
  if(!chip) return;
  document.querySelectorAll('.style-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
});

// STATUS
function setStatus(type, text) {
  const dot = document.getElementById('statusDot');
  dot.className = 'status-dot ' + type;
  document.getElementById('statusText').textContent = text;
}

// NOTIFICATION
function showNotif(msg, type='info') {
  const n = document.getElementById('notif');
  const icon = type === 'error' ? '✗' : type === 'success' ? '✓' : 'ℹ';
  n.innerHTML = `<span style="color:${type==='error'?'#ef4444':type==='success'?'#10b981':'var(--accent)'};">${icon}</span> ${msg}`;
  n.className = 'notif show ' + type;
  clearTimeout(n._t);
  n._t = setTimeout(() => { n.className = 'notif ' + type; }, 4000);
}

// FILTER MODELS
function filterModels(q) {
  document.querySelectorAll('.model-row').forEach(r => {
    r.classList.toggle('hidden', !r.textContent.toLowerCase().includes(q.toLowerCase()));
  });
}

// SELECTED MODEL STATE
let selectedModel = '';

// LIST MODELS MODAL
async function openModelPicker() {
  let key = document.getElementById('apiKey');
  key=key.value=`AIzaSyDvK1QidZZ1ZNdfLBROsko2wvO9aiMFBi0`;
  if(!key?.trim()) { showNotif('Paste your API key first', 'error'); return; }

  const modal = document.getElementById('modelModal');
  const list  = document.getElementById('modelList');
  modal.classList.add('open');
  list.innerHTML = `<div class="model-loading"><div class="btn-spinner" style="display:block;border-color:rgba(124,106,255,0.3);border-top-color:var(--accent);width:28px;height:28px;"></div><span>Fetching models…</span></div>`;

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=200`);
    if(!res.ok) {
      const e = await res.json().catch(()=>({}));
      throw new Error(e?.error?.message || `HTTP ${res.status}`);
    }
    const data = await res.json();
    const models = (data.models || []).filter(m =>
      (m.supportedGenerationMethods||[]).includes('generateContent') &&
      (m.name.includes('image') || m.name.includes('imagen') || m.name.includes('flash') || m.name.includes('pro') || m.name.includes('ultra'))
    );

    if(!models.length) { list.innerHTML = `<p style="padding:24px;color:var(--text2);text-align:center;">No compatible models found for this key.</p>`; return; }

    list.innerHTML = models.map(m => {
      const id   = m.name.replace('models/', '');
      const isImg= m.name.includes('image') || m.name.includes('imagen');
      const badge= isImg ? `<span class="model-badge img-badge">Image</span>` : `<span class="model-badge">Text+Image</span>`;
      const active = id === selectedModel ? ' selected-model' : '';
      return `
        <div class="model-row${active}" onclick="selectModel('${id}')">
          <div class="model-row-inner">
            <div>
              <div class="model-id">${id}</div>
              <div class="model-desc">${m.displayName || ''}</div>
            </div>
            ${badge}
          </div>
        </div>`;
    }).join('');
  } catch(err) {
    list.innerHTML = `<p style="padding:24px;color:#ef4444;text-align:center;">${err.message}</p>`;
  }
}

function selectModel(id) {
  selectedModel = id;
  document.getElementById('selectedModelLabel').textContent = id;
  document.querySelectorAll('.model-row').forEach(r => r.classList.remove('selected-model'));
  document.querySelectorAll('.model-row').forEach(r => { if(r.textContent.includes(id)) r.classList.add('selected-model'); });
  closeModal();
  showNotif(`Model set to ${id}`, 'success');
}

function closeModal() { document.getElementById('modelModal').classList.remove('open'); }
document.getElementById('modelModal').addEventListener('click', e => { if(e.target === document.getElementById('modelModal')) closeModal(); });

// GENERATE
async function generateImages() {
  let key = document.getElementById('apiKey');
  key=key.value=`AIzaSyDvK1QidZZ1ZNdfLBROsko2wvO9aiMFBi0`;

  
  const prompt = document.getElementById('promptInput').value.trim();
  const activeChip = document.querySelector('.style-chip.active');
  const styleTag = activeChip ? activeChip.dataset.style : '';
  const count = parseInt(document.getElementById('numImages').value);

  if(!key?.trim())          { showNotif('Please enter your Google AI Studio API key', 'error'); return; }
  if(!prompt)       { showNotif('Please describe what you want to generate', 'error'); return; }
  if(!selectedModel){ showNotif('Click "Browse Models" to pick a model first', 'error'); return; }

  const btn = document.getElementById('generateBtn');
  btn.disabled = true;
  btn.classList.add('generating');
  setStatus('loading', `Generating with ${selectedModel}…`);

  document.getElementById('emptyState').style.display = 'none';
  const grid = document.getElementById('outputGrid');
  grid.style.display = 'grid';

  grid.innerHTML = Array.from({length: count}, () => `
    <div class="skeleton-card">
      <div class="skeleton-img"></div>
      <div class="skeleton-bar"></div>
      <div class="skeleton-bar skeleton-bar-sm"></div>
    </div>
  `).join('');

  const fullPrompt = styleTag ? `${prompt}, ${styleTag}` : prompt;
  const timestamp  = new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});

  const requests = Array.from({length: count}, () => generateOne(key, fullPrompt, selectedModel));
  const settled  = await Promise.allSettled(requests);
  const results  = settled.map(r => r.status === 'fulfilled' ? r.value : {error: r.reason?.message || 'Failed'});

  const successful = results.filter(r => r.data);
  if(!successful.length) {
    grid.innerHTML = '';
    document.getElementById('emptyState').style.display = '';
    setStatus('error', 'Generation failed');
    showNotif(results[0]?.error || 'Failed. Try a different model.', 'error');
    btn.disabled = false; btn.classList.remove('generating');
    return;
  }

  grid.innerHTML = '';
  results.forEach((r, i) => {
    if(!r.data) return;
    const card = document.createElement('div');
    card.className = 'output-card reveal';
    const shortPrompt = prompt.length > 40 ? prompt.slice(0,40)+'…' : prompt;
    const esc = s => s.replace(/'/g,"&#39;");
    card.innerHTML = `
      <div class="output-img-wrap">
        <img src="data:${r.mime||'image/png'};base64,${r.data}" alt="${esc(shortPrompt)}" loading="lazy">
        <div class="output-overlay">
          <button class="overlay-btn" onclick="downloadImg(this,'${esc(shortPrompt)}')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:5px;"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Download
          </button>
          <button class="overlay-btn" onclick="copyPrompt('${esc(prompt)}')">Copy prompt</button>
        </div>
      </div>
      <div class="output-meta">
        <span class="output-prompt-text">${shortPrompt}</span>
        <span class="output-time">${timestamp}</span>
      </div>`;
    grid.appendChild(card);
    setTimeout(() => card.classList.add('visible'), i * 120);
  });

  setStatus('success', `${successful.length} image${successful.length>1?'s':''} generated`);
  showNotif(`${successful.length} image${successful.length>1?'s':''} created!`, 'success');
  btn.disabled = false; btn.classList.remove('generating');
}

async function generateOne(apiKey, prompt, model) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
    })
  });
  if(!res.ok) {
    const e = await res.json().catch(()=>({}));
    throw new Error(e?.error?.message || `HTTP ${res.status}`);
  }
  const data  = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const img   = parts.find(p => p.inlineData?.mimeType?.startsWith('image'));
  if(!img) throw new Error('No image returned — model may not support image output');
  return { data: img.inlineData.data, mime: img.inlineData.mimeType };
}

function downloadImg(btn, name) {
  const img = btn.closest('.output-card').querySelector('img');
  const a = document.createElement('a');
  a.href = img.src; a.download = `lumina-${name}-${Date.now()}.png`; a.click();
}

function copyPrompt(p) {
  navigator.clipboard.writeText(p).then(() => showNotif('Prompt copied!', 'success'));
}

document.getElementById('promptInput').addEventListener('keydown', e => {
  if(e.key === 'Enter' && (e.metaKey || e.ctrlKey)) generateImages();
});