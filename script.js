/* ============================
   Budget — script
   ============================ */

const STATE_KEY = 'budget_v1_state';
const CATEGORIES = ['식비', '관리비', '교통비', '통신비', '구독료', '생필품', '기타'];
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];

/* ---------- state ---------- */
function defaultState() {
  return { currentMonth: monthKey(new Date()), expenses: [], budgets: {}, templates: [] };
}
function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return defaultState();
    const s = JSON.parse(raw);
    return Object.assign(defaultState(), s);
  } catch { return defaultState(); }
}
function saveState() {
  localStorage.setItem(STATE_KEY, JSON.stringify(state));
}
let state = loadState();
state.currentMonth = monthKey(new Date());
let __seededCount = 0;
function seedTemplates() {
  const m = monthKey(new Date());
  const [y, mo] = m.split('-').map(Number);
  state.templates.forEach(t => {
    if (t.lastInsertedMonth === m) return;
    const date = new Date(y, mo - 1, 1, 9, 0, 0);
    state.expenses.push({
      id: uid(),
      date: date.toISOString(),
      amount: t.amount,
      category: t.category,
      memo: t.memo
    });
    t.lastInsertedMonth = m;
    __seededCount++;
  });
}
seedTemplates();
saveState();

/* ---------- utils ---------- */
function monthKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}
function monthAdd(monthStr, delta) {
  const [y, m] = monthStr.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + delta, 1));
}
function monthLabel(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  return { name: MONTH_NAMES[m-1], year: String(y) };
}
function fmt(n) { return n.toLocaleString('ko-KR'); }
function fmtDate(iso) {
  const d = new Date(iso);
  return `${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function uid() {
  return Math.random().toString(36).slice(2,9) + Date.now().toString(36).slice(-3);
}
function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function getMonthExpenses(month) {
  return state.expenses.filter(e => e.date.slice(0,7) === month);
}
function getCategoryTotals(month) {
  const totals = {};
  CATEGORIES.forEach(c => totals[c] = 0);
  getMonthExpenses(month).forEach(e => {
    if (totals[e.category] !== undefined) totals[e.category] += e.amount;
  });
  return totals;
}
function makeRecordDate(monthStr) {
  const now = new Date();
  const [y, m] = monthStr.split('-').map(Number);
  if (now.getFullYear() === y && now.getMonth() + 1 === m) return now;
  const lastDay = new Date(y, m, 0);
  lastDay.setHours(12, 0, 0, 0);
  return lastDay;
}
function isCurrentMonth() {
  return state.currentMonth === monthKey(new Date());
}

/* ---------- routing ---------- */
function parseRoute() {
  const h = location.hash.slice(2);
  if (h.startsWith('category/')) {
    return { name: 'category', cat: decodeURIComponent(h.slice(9)) };
  }
  return { name: 'home' };
}
function navigate(path) { location.hash = '#/' + path; }
window.addEventListener('hashchange', render);

/* ---------- DOM ---------- */
const app = document.getElementById('app');
const modalRoot = document.getElementById('modal-root');

function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function render() {
  const route = parseRoute();
  app.innerHTML = '';
  if (route.name === 'home') renderHome();
  else if (route.name === 'category') renderCategory(route.cat);
}

/* ---------- HOME ---------- */
function renderHome() {
  const month = state.currentMonth;
  const totals = getCategoryTotals(month);
  const sorted = CATEGORIES.slice().sort((a,b) => totals[b] - totals[a]);
  const sumTotal = Object.values(totals).reduce((a,b) => a+b, 0);
  const { name, year } = monthLabel(month);

  const header = el(`
    <header class="header">
      <button class="month-nav" id="prev-month" aria-label="이전 달">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <div class="month-display">
        <div class="month-year">${year}</div>
        <div class="month-name">${name}</div>
      </div>
      <button class="month-nav" id="next-month" aria-label="다음 달">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </header>
  `);
  app.appendChild(header);

  const summary = el(`
    <section class="summary">
      <div class="summary-label">Total</div>
      <div class="summary-amount"><span class="currency">₩</span>${fmt(sumTotal)}</div>
    </section>
  `);
  app.appendChild(summary);

  const cards = el(`<section class="cards"></section>`);
  sorted.forEach((cat, i) => {
    const used = totals[cat];
    const limit = state.budgets[cat];
    const hasLimit = typeof limit === 'number' && limit > 0;
    const pct = hasLimit ? Math.round((used / limit) * 100) : null;
    const isOver = hasLimit && used > limit;

    let pctHTML;
    if (hasLimit) {
      pctHTML = `<div class="card-pct ${isOver ? 'over' : ''}">${pct}%</div>`;
    } else {
      pctHTML = `<div class="card-pct dash">—</div>`;
    }

    let amountHTML;
    if (hasLimit) {
      amountHTML = `<div class="card-amount"><span>${fmt(used)}</span><span class="limit">/ ${fmt(limit)}</span></div>`;
    } else {
      amountHTML = `<div class="card-amount"><span>${fmt(used)}</span></div>`;
    }

    let barHTML;
    if (hasLimit) {
      const fillPct = Math.min(used, limit) / limit;
      // 초과분은 바 트랙 우측에 50%까지 시각적으로만 (실제로는 더 커도 50%로 캡)
      const overPct = isOver ? Math.min((used - limit) / limit, 0.5) : 0;
      barHTML = `
        <div class="bar-wrap">
          <div class="bar ${isOver ? 'has-over' : ''}">
            <div class="bar-fill" style="--target: ${fillPct.toFixed(3)}"></div>
            ${isOver ? `<div class="bar-over" style="--target: ${overPct.toFixed(3)}"></div>` : ''}
          </div>
        </div>`;
    } else {
      barHTML = `<div class="bar-wrap"><div class="bar empty"></div></div>`;
    }

    const card = el(`
      <article class="card" style="animation-delay: ${50 + i * 55}ms" data-category="${cat}">
        <div class="card-head">
          <div class="card-name">${cat}</div>
          ${pctHTML}
        </div>
        ${amountHTML}
        ${barHTML}
      </article>
    `);

    bindLongPress(card,
      () => navigate('category/' + encodeURIComponent(cat)),
      () => openBudgetModal(cat)
    );

    cards.appendChild(card);
  });
  app.appendChild(cards);

  if (isCurrentMonth()) {
    const fab = el(`
      <button class="fab" aria-label="지출 추가">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
      </button>
    `);
    fab.addEventListener('click', () => openAddModal());
    app.appendChild(fab);
  }

  app.appendChild(el(`<div class="brand">a budget journal</div>`));

  header.querySelector('#prev-month').addEventListener('click', () => changeMonth(-1));
  header.querySelector('#next-month').addEventListener('click', () => changeMonth(1));
  header.querySelector('.month-display').addEventListener('click', () => openMonthPicker());
}

function changeMonth(delta) {
  state.currentMonth = monthAdd(state.currentMonth, delta);
  saveState();
  app.classList.add('fade-leave');
  setTimeout(() => {
    render();
    app.classList.remove('fade-leave');
    app.classList.add(delta > 0 ? 'fade-enter-r' : 'fade-enter-l');
    setTimeout(() => app.classList.remove('fade-enter-r', 'fade-enter-l'), 320);
  }, 180);
}
function setMonth(monthStr) {
  if (monthStr === state.currentMonth) return;
  const dir = monthStr > state.currentMonth ? 1 : -1;
  state.currentMonth = monthStr;
  saveState();
  app.classList.add('fade-leave');
  setTimeout(() => {
    render();
    app.classList.remove('fade-leave');
    app.classList.add(dir > 0 ? 'fade-enter-r' : 'fade-enter-l');
    setTimeout(() => app.classList.remove('fade-enter-r', 'fade-enter-l'), 320);
  }, 180);
}

/* ---------- CATEGORY DETAIL ---------- */
function renderCategory(cat) {
  if (!CATEGORIES.includes(cat)) { navigate(''); return; }
  const month = state.currentMonth;
  const ex = getMonthExpenses(month).filter(e => e.category === cat).sort((a,b) => b.date.localeCompare(a.date));
  const total = ex.reduce((a,b) => a + b.amount, 0);
  const { name, year } = monthLabel(month);
  const templates = state.templates.filter(t => t.category === cat);
  const curMonth = isCurrentMonth();

  app.appendChild(el(`
    <header class="detail-header">
      <button class="back-btn" id="back-btn" aria-label="뒤로">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <div class="detail-title">
        <div class="detail-title-name">${escapeHtml(cat)} · ${name} ${year}</div>
        <div class="detail-title-amount"><span class="currency">₩</span>${fmt(total)}</div>
      </div>
      <div></div>
    </header>
  `));

  const showTemplates = templates.length > 0 || curMonth;
  if (showTemplates) {
    const tplSection = el(`
      <section class="templates-section">
        <div class="section-label">
          <span>고정 지출</span>
          ${curMonth && templates.length > 0 ? `<button class="section-add" id="tpl-add" aria-label="템플릿 추가"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></button>` : ''}
        </div>
        ${templates.length > 0
          ? '<ul class="templates-list" id="tpl-list"></ul>'
          : (curMonth ? '<div class="templates-empty" id="tpl-empty">+ 고정지출 추가</div>' : '')}
      </section>
    `);
    app.appendChild(tplSection);

    if (templates.length > 0) {
      const list = tplSection.querySelector('#tpl-list');
      templates.forEach(t => {
        const row = el(`
          <li class="template" data-id="${t.id}">
            <div class="template-memo ${t.memo ? '' : 'empty'}">${t.memo ? escapeHtml(t.memo) : '메모 없음'}</div>
            <div class="template-amount">${fmt(t.amount)}</div>
          </li>
        `);
        bindLongPress(row, () => openTemplateModal(cat, t.id), null);
        bindSwipeDelete(row, () => {
          state.templates = state.templates.filter(x => x.id !== t.id);
          saveState();
          setTimeout(render, 250);
        });
        list.appendChild(row);
      });
      tplSection.querySelector('#tpl-add')?.addEventListener('click', () => openTemplateModal(cat));
    } else if (curMonth) {
      tplSection.querySelector('#tpl-empty').addEventListener('click', () => openTemplateModal(cat));
    }
  }

  if (ex.length === 0) {
    app.appendChild(el(`
      <div class="empty-state">
        <div class="empty-state-mark">∅</div>
        <div class="empty-state-text">기록 없음</div>
      </div>
    `));
  } else {
    if (showTemplates) {
      app.appendChild(el(`<div class="section-label entries-label"><span>기록</span></div>`));
    }
    const list = el('<section class="entries"></section>');
    ex.forEach((e, i) => {
      const node = el(`
        <article class="entry" data-id="${e.id}" style="animation-delay: ${30 + i * 30}ms">
          <div class="entry-info">
            <div class="entry-date">${fmtDate(e.date)}</div>
            <div class="entry-memo ${e.memo ? '' : 'empty'}">${e.memo ? escapeHtml(e.memo) : '메모 없음'}</div>
          </div>
          <div class="entry-amount">${fmt(e.amount)}</div>
        </article>
      `);
      bindLongPress(node, null, () => openEditModal(e.id));
      bindSwipeDelete(node, () => {
        state.expenses = state.expenses.filter(x => x.id !== e.id);
        saveState();
        setTimeout(render, 250);
      });
      list.appendChild(node);
    });
    app.appendChild(list);
  }

  if (isCurrentMonth()) {
    const fab = el(`
      <button class="fab" aria-label="지출 추가">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
      </button>
    `);
    fab.addEventListener('click', () => openAddModal(cat));
    app.appendChild(fab);
  }

  app.querySelector('#back-btn').addEventListener('click', () => {
    if (history.length > 1) history.back();
    else navigate('');
  });
}

/* ---------- TOAST ---------- */
function showToast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const toast = el(`<div class="toast">${escapeHtml(message)}</div>`);
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('is-visible'));
  setTimeout(() => {
    toast.classList.remove('is-visible');
    setTimeout(() => toast.remove(), 320);
  }, 2500);
}

/* ---------- MODALS ---------- */
let modalIsOpen = false;
function openModal(content) {
  closeModal(true);
  const backdrop = el(`<div class="modal-backdrop"></div>`);
  const modal = el(`<div class="modal"><div class="modal-handle"></div>${content}</div>`);
  backdrop.appendChild(modal);
  modalRoot.appendChild(backdrop);
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) closeModal();
  });
  requestAnimationFrame(() => backdrop.classList.add('is-open'));
  modalIsOpen = true;
  history.pushState({ modal: true }, '');
  return { backdrop, modal };
}
function closeModal(immediate = false) {
  const bd = modalRoot.querySelector('.modal-backdrop');
  if (!bd) return;
  const wasOpen = modalIsOpen;
  modalIsOpen = false;
  if (immediate) {
    bd.remove();
  } else {
    bd.classList.remove('is-open');
    setTimeout(() => bd.remove(), 360);
    document.activeElement && document.activeElement.blur && document.activeElement.blur();
  }
  // 사용자가 취소/저장으로 닫을 땐 push해둔 history entry도 같이 정리
  if (wasOpen && history.state && history.state.modal) {
    history.back();
  }
}
window.addEventListener('popstate', () => {
  if (modalIsOpen) closeModal();
});

function attachAmountFormatter(input) {
  input.addEventListener('input', () => {
    const raw = input.value.replace(/[^0-9]/g, '');
    input.value = raw ? Number(raw).toLocaleString('ko-KR') : '';
  });
}

function openAddModal(prefilledCat = null) {
  const { modal } = openModal(`
    <div class="modal-title">지출 기록</div>
    <div class="modal-subtitle">${monthLabel(state.currentMonth).name} ${monthLabel(state.currentMonth).year}</div>
    <div class="cat-chips">
      ${CATEGORIES.map(c => `<button class="cat-chip ${c === prefilledCat ? 'is-active' : ''}" data-cat="${c}">${c}</button>`).join('')}
    </div>
    <div class="field">
      <input type="text" inputmode="numeric" pattern="[0-9,]*" class="field-input is-amount" id="amount-input" placeholder="0" />
    </div>
    <div class="field">
      <label class="field-label">메모</label>
      <input type="text" class="field-input" id="memo-input" placeholder="(선택)" maxlength="60" />
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" id="cancel-btn">취소</button>
      <button class="btn btn-primary" id="save-btn" disabled>저장</button>
    </div>
  `);

  let selectedCat = prefilledCat;
  const amountInput = modal.querySelector('#amount-input');
  const memoInput = modal.querySelector('#memo-input');
  const saveBtn = modal.querySelector('#save-btn');

  modal.querySelectorAll('.cat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      modal.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      selectedCat = chip.dataset.cat;
      checkValid();
    });
  });

  attachAmountFormatter(amountInput);
  amountInput.addEventListener('input', checkValid);

  function checkValid() {
    const amt = Number(amountInput.value.replace(/,/g, ''));
    saveBtn.disabled = !(selectedCat && amt > 0);
  }

  modal.querySelector('#cancel-btn').addEventListener('click', () => closeModal());
  saveBtn.addEventListener('click', () => {
    const amt = Number(amountInput.value.replace(/,/g, ''));
    if (!selectedCat || !(amt > 0)) return;
    state.expenses.push({
      id: uid(),
      date: makeRecordDate(state.currentMonth).toISOString(),
      amount: amt,
      category: selectedCat,
      memo: memoInput.value.trim()
    });
    saveState();
    closeModal();
    setTimeout(render, 100);
  });
}

function openEditModal(id) {
  const e = state.expenses.find(x => x.id === id);
  if (!e) return;
  const { modal } = openModal(`
    <div class="modal-title">지출 수정</div>
    <div class="modal-subtitle">${fmtDate(e.date)}</div>
    <div class="cat-chips">
      ${CATEGORIES.map(c => `<button class="cat-chip ${c === e.category ? 'is-active' : ''}" data-cat="${c}">${c}</button>`).join('')}
    </div>
    <div class="field">
      <input type="text" inputmode="numeric" pattern="[0-9,]*" class="field-input is-amount" id="amount-input" value="${fmt(e.amount)}" />
    </div>
    <div class="field">
      <label class="field-label">메모</label>
      <input type="text" class="field-input" id="memo-input" maxlength="60" value="${escapeHtml(e.memo || '')}" />
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" id="cancel-btn">취소</button>
      <button class="btn btn-primary" id="save-btn">저장</button>
    </div>
  `);

  let selectedCat = e.category;
  modal.querySelectorAll('.cat-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      modal.querySelectorAll('.cat-chip').forEach(c => c.classList.remove('is-active'));
      chip.classList.add('is-active');
      selectedCat = chip.dataset.cat;
    });
  });

  const amountInput = modal.querySelector('#amount-input');
  attachAmountFormatter(amountInput);

  modal.querySelector('#cancel-btn').addEventListener('click', () => closeModal());
  modal.querySelector('#save-btn').addEventListener('click', () => {
    const amt = Number(amountInput.value.replace(/,/g, ''));
    if (!(amt > 0) || !selectedCat) return;
    e.amount = amt;
    e.category = selectedCat;
    e.memo = modal.querySelector('#memo-input').value.trim();
    saveState();
    closeModal();
    setTimeout(render, 100);
  });
}

function openBudgetModal(cat) {
  const cur = state.budgets[cat];
  const { modal } = openModal(`
    <div class="modal-title">${escapeHtml(cat)} 예산</div>
    <div class="modal-subtitle">월 한도</div>
    <div class="field">
      <input type="text" inputmode="numeric" pattern="[0-9,]*" class="field-input is-amount center" id="budget-input" placeholder="0" value="${cur ? fmt(cur) : ''}" />
    </div>
    <div class="modal-hint">비워두면 한도 미설정</div>
    <div class="modal-actions">
      <button class="btn btn-secondary" id="cancel-btn">취소</button>
      <button class="btn btn-primary" id="save-btn">저장</button>
    </div>
  `);

  const input = modal.querySelector('#budget-input');
  attachAmountFormatter(input);

  modal.querySelector('#cancel-btn').addEventListener('click', () => closeModal());
  modal.querySelector('#save-btn').addEventListener('click', () => {
    const v = Number(input.value.replace(/,/g, ''));
    if (v > 0) state.budgets[cat] = v;
    else delete state.budgets[cat];
    saveState();
    closeModal();
    setTimeout(render, 100);
  });

  setTimeout(() => input.focus(), 250);
}

function openTemplateModal(cat, templateId = null) {
  const existing = templateId ? state.templates.find(t => t.id === templateId) : null;
  const { modal } = openModal(`
    <div class="modal-title">${existing ? '템플릿 수정' : '고정지출 추가'}</div>
    <div class="modal-subtitle">${escapeHtml(cat)} · 매월 1일</div>
    <div class="field">
      <input type="text" inputmode="numeric" pattern="[0-9,]*" class="field-input is-amount" id="amount-input" placeholder="0" value="${existing ? fmt(existing.amount) : ''}" />
    </div>
    <div class="field">
      <label class="field-label">메모</label>
      <input type="text" class="field-input" id="memo-input" placeholder="(예: 월세)" maxlength="60" value="${existing ? escapeHtml(existing.memo || '') : ''}" />
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary" id="cancel-btn">취소</button>
      <button class="btn btn-primary" id="save-btn" ${existing ? '' : 'disabled'}>저장</button>
    </div>
  `);

  const amountInput = modal.querySelector('#amount-input');
  const memoInput = modal.querySelector('#memo-input');
  const saveBtn = modal.querySelector('#save-btn');

  attachAmountFormatter(amountInput);
  amountInput.addEventListener('input', () => {
    const amt = Number(amountInput.value.replace(/,/g, ''));
    saveBtn.disabled = !(amt > 0);
  });

  modal.querySelector('#cancel-btn').addEventListener('click', () => closeModal());
  saveBtn.addEventListener('click', () => {
    const amt = Number(amountInput.value.replace(/,/g, ''));
    if (!(amt > 0)) return;
    const memo = memoInput.value.trim();
    if (existing) {
      existing.amount = amt;
      existing.memo = memo;
    } else {
      const cm = monthKey(new Date());
      const [y, mo] = cm.split('-').map(Number);
      const date = new Date(y, mo - 1, 1, 9, 0, 0);
      const newT = {
        id: uid(),
        category: cat,
        memo: memo,
        amount: amt,
        lastInsertedMonth: cm,
        createdAt: new Date().toISOString()
      };
      state.templates.push(newT);
      state.expenses.push({
        id: uid(),
        date: date.toISOString(),
        amount: amt,
        category: cat,
        memo: memo
      });
    }
    saveState();
    closeModal();
    setTimeout(render, 100);
  });

  if (!existing) setTimeout(() => amountInput.focus(), 250);
}

function openMonthPicker() {
  const [curY, curM] = state.currentMonth.split('-').map(Number);
  const today = new Date();
  const todayY = today.getFullYear();
  const todayM = today.getMonth() + 1;
  let viewYear = curY;

  const { modal } = openModal(`
    <div class="modal-title">이동</div>
    <div class="modal-subtitle">${todayY} · ${MONTH_NAMES[todayM - 1]}</div>
    <div class="year-stepper">
      <button id="year-prev" aria-label="이전 연도">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      </button>
      <div class="year-stepper-value" id="year-value"></div>
      <button id="year-next" aria-label="다음 연도">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
      </button>
    </div>
    <div class="month-grid" id="month-grid"></div>
  `);

  const yearValue = modal.querySelector('#year-value');
  const grid = modal.querySelector('#month-grid');

  function renderGrid() {
    yearValue.textContent = String(viewYear);
    grid.innerHTML = '';
    for (let m = 1; m <= 12; m++) {
      const monthStr = `${viewYear}-${String(m).padStart(2, '0')}`;
      const isSelected = (viewYear === curY && m === curM);
      const isToday = (viewYear === todayY && m === todayM);
      const cell = el(`
        <button class="month-cell ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}" data-month="${monthStr}">
          ${MONTH_NAMES[m - 1].slice(0, 3)}
        </button>
      `);
      cell.addEventListener('click', () => {
        closeModal();
        setTimeout(() => setMonth(monthStr), 200);
      });
      grid.appendChild(cell);
    }
  }

  modal.querySelector('#year-prev').addEventListener('click', () => { viewYear--; renderGrid(); });
  modal.querySelector('#year-next').addEventListener('click', () => { viewYear++; renderGrid(); });
  renderGrid();
}

/* ---------- INTERACTIONS ---------- */
function bindLongPress(target, onPress, onLong, threshold = 480) {
  let timer = null, triggered = false, startX = 0, startY = 0;

  function start(e) {
    if (e.button !== undefined && e.button !== 0) return;
    triggered = false;
    const t = e.touches ? e.touches[0] : e;
    startX = t.clientX; startY = t.clientY;
    target.classList.add('is-pressing');
    timer = setTimeout(() => {
      triggered = true;
      target.classList.remove('is-pressing');
      if (navigator.vibrate) navigator.vibrate(8);
      timer = null;
      if (onLong) onLong(e);
    }, threshold);
  }
  function move(e) {
    if (!timer) return;
    const t = e.touches ? e.touches[0] : e;
    if (Math.abs(t.clientX - startX) > 8 || Math.abs(t.clientY - startY) > 8) cancel();
  }
  function end(e) {
    if (timer) {
      clearTimeout(timer); timer = null;
      target.classList.remove('is-pressing');
      if (!triggered && onPress) onPress(e);
    }
    triggered = false;
  }
  function cancel() {
    if (timer) { clearTimeout(timer); timer = null; }
    target.classList.remove('is-pressing');
  }

  target.addEventListener('touchstart', start, { passive: true });
  target.addEventListener('touchmove', move, { passive: true });
  target.addEventListener('touchend', end);
  target.addEventListener('touchcancel', cancel);
  target.addEventListener('mousedown', start);
  target.addEventListener('mousemove', move);
  target.addEventListener('mouseup', end);
  target.addEventListener('mouseleave', cancel);
}

function bindSwipeDelete(target, onDelete, threshold = 90) {
  let startX = null, startY = null, dx = 0, swiping = false, locked = false;

  function start(e) {
    const t = e.touches ? e.touches[0] : e;
    startX = t.clientX; startY = t.clientY; dx = 0; swiping = false; locked = false;
  }
  function move(e) {
    if (startX === null || locked) return;
    const t = e.touches ? e.touches[0] : e;
    const ddx = t.clientX - startX;
    const ddy = t.clientY - startY;
    if (!swiping) {
      if (Math.abs(ddy) > Math.abs(ddx) && Math.abs(ddy) > 10) { locked = true; return; }
      if (Math.abs(ddx) > 10) swiping = true;
      else return;
    }
    if (ddx > 0) {
      dx = ddx;
      target.style.transform = `translateX(${ddx}px)`;
      target.style.transition = 'none';
      target.style.background = `rgba(165, 63, 43, ${Math.min(0.14, ddx / 600)})`;
    } else {
      target.style.transform = '';
      target.style.background = '';
    }
  }
  function end() {
    if (startX === null) return;
    target.style.transition = '';
    if (dx > threshold) {
      target.classList.add('is-deleting');
      setTimeout(() => onDelete(), 240);
    } else {
      target.style.transform = '';
      target.style.background = '';
    }
    startX = null; dx = 0; swiping = false; locked = false;
  }

  target.addEventListener('touchstart', start, { passive: true });
  target.addEventListener('touchmove', move, { passive: true });
  target.addEventListener('touchend', end);
  target.addEventListener('touchcancel', end);
}

/* ---------- INIT ---------- */
render();
if (__seededCount > 0) {
  const [, mo] = monthKey(new Date()).split('-').map(Number);
  setTimeout(() => showToast(`${mo}월 고정지출 ${__seededCount}건 추가`), 500);
}
