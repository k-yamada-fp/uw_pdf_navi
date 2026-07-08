import { loadCsv } from './csv.js';

const SIMPLE_ACCESS_PASSWORD = 'Fic12345';
const ACCESS_SESSION_KEY = 'pdf_navi_simple_access';

const state = {
  documents: [],
  tocEntries: [],
  selectedIds: new Set(),
  results: [],
  initialized: false
};

const accessGate = document.getElementById('access-gate');
const accessForm = document.getElementById('access-form');
const accessPassword = document.getElementById('access-password');
const accessError = document.getElementById('access-error');
const appShell = document.getElementById('app-shell');
const sourceList = document.getElementById('source-list');
const selectedCount = document.getElementById('selected-count');
const selectAllButton = document.getElementById('select-all');
const clearAllButton = document.getElementById('clear-all');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const resultSummary = document.getElementById('result-summary');
const resultList = document.getElementById('result-list');

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function sortByOrder(left, right) {
  return toNumber(left.sort_order, 999999) - toNumber(right.sort_order, 999999);
}

function sortResults(left, right) {
  const leftDoc = getDoc(left.document_id) || {};
  const rightDoc = getDoc(right.document_id) || {};
  const docCompare = sortByOrder(leftDoc, rightDoc);
  if (docCompare !== 0) return docCompare;

  const pdfPageCompare = toNumber(left.pdf_page_number, 999999) - toNumber(right.pdf_page_number, 999999);
  if (pdfPageCompare !== 0) return pdfPageCompare;

  const documentPageCompare =
    toNumber(left.document_page_number, 999999) - toNumber(right.document_page_number, 999999);
  if (documentPageCompare !== 0) return documentPageCompare;

  return String(left.item_name || '').localeCompare(String(right.item_name || ''), 'ja-JP');
}

function getDoc(documentId) {
  return state.documents.find((doc) => doc.document_id === documentId);
}

function pdfPath(pdfFile) {
  return `pdfs/${pdfFile.split('/').map((part) => encodeURIComponent(part)).join('/')}`;
}

function updateSelectedCount() {
  selectedCount.textContent = `選択中：${state.selectedIds.size} / ${state.documents.length}件`;
}

function renderSources() {
  sourceList.textContent = '';
  state.documents.forEach((doc) => {
    const card = document.createElement('label');
    card.className = 'source-card';
    if (state.selectedIds.has(doc.document_id)) {
      card.classList.add('is-selected');
    }

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = state.selectedIds.has(doc.document_id);
    checkbox.addEventListener('change', () => {
      if (checkbox.checked) {
        state.selectedIds.add(doc.document_id);
      } else {
        state.selectedIds.delete(doc.document_id);
      }
      renderSources();
      runSearch();
    });

    const icon = document.createElement('div');
    icon.className = 'pdf-icon';
    icon.textContent = 'PDF';

    const body = document.createElement('div');
    const company = document.createElement('strong');
    company.textContent = doc.company_name;
    const meta = document.createElement('span');
    meta.textContent = `${doc.document_name}｜${doc.version_label}`;
    const file = document.createElement('span');
    const ym = doc.version_label.replace('年', '/').replace('月版', '');
    file.textContent = `PDF・${ym || doc.pdf_file}`;

    body.append(company, meta, file);
    card.append(checkbox, icon, body);
    sourceList.appendChild(card);
  });
  updateSelectedCount();
}

function clearResults(message) {
  state.results = [];
  resultSummary.textContent = message;
  resultList.textContent = '';
}

function runSearch() {
  const query = searchInput.value.trim();
  if (!query) {
    clearResults('検索語を入力してください。');
    return;
  }

  const selected = state.selectedIds;
  if (selected.size === 0) {
    clearResults('検索対象の資料を選択してください。');
    return;
  }

  const lowered = query.toLocaleLowerCase('ja-JP');
  state.results = state.tocEntries
    .filter((entry) => selected.has(entry.document_id))
    .filter((entry) => (entry.item_name || '').toLocaleLowerCase('ja-JP').includes(lowered))
    .sort(sortResults);

  resultSummary.textContent = `検索結果：${state.results.length}件（検索語：${query}）`;
  renderResults();
}

function renderResults() {
  resultList.textContent = '';
  if (state.results.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.textContent = '該当する索引項目は見つかりませんでした。検索対象は item_name のみです。';
    resultList.appendChild(empty);
    return;
  }

  groupResultsByCompany(state.results).forEach((group) => {
    resultList.appendChild(companyHeading(group));
    group.entries.forEach((entry) => {
      const card = resultCard(entry);
      if (card) {
        resultList.appendChild(card);
      }
    });
  });
}

function groupResultsByCompany(entries) {
  const groups = [];
  const groupMap = new Map();

  entries.forEach((entry) => {
    const doc = getDoc(entry.document_id);
    if (!doc) return;
    const key = doc.company_name || '会社名未設定';
    if (!groupMap.has(key)) {
      const group = { companyName: key, docs: new Map(), entries: [] };
      groupMap.set(key, group);
      groups.push(group);
    }
    const group = groupMap.get(key);
    group.entries.push(entry);
    group.docs.set(doc.document_id, doc);
  });

  return groups;
}

function companyHeading(group) {
  const heading = document.createElement('section');
  heading.className = 'company-result-heading';

  const title = document.createElement('div');
  title.className = 'company-result-title';
  const company = document.createElement('h3');
  company.textContent = group.companyName;
  const count = document.createElement('span');
  count.textContent = `${group.entries.length}件`;
  title.append(company, count);

  const meta = document.createElement('p');
  const docLabels = [...group.docs.values()]
    .map((doc) => `${doc.document_name}｜${doc.version_label}`)
    .filter(Boolean);
  meta.textContent = docLabels.length > 0 ? docLabels.join(' / ') : '資料情報なし';

  heading.append(title, meta);
  return heading;
}

function resultCard(entry) {
  const doc = getDoc(entry.document_id);
  if (!doc) return null;

  const card = document.createElement('article');
  card.className = 'result-card';

  const top = document.createElement('div');
  top.className = 'result-top';
  const title = document.createElement('div');
  const company = document.createElement('p');
  company.className = 'company-name';
  company.textContent = doc.company_name;
  const docMeta = document.createElement('p');
  docMeta.className = 'doc-meta';
  docMeta.textContent = `${doc.document_name}｜${doc.version_label}`;
  title.append(company, docMeta);
  const sourceType = document.createElement('span');
  sourceType.className = 'source-type';
  sourceType.textContent = entry.source_type || '索引';
  top.append(title, sourceType);

  const grid = document.createElement('div');
  grid.className = 'result-grid';
  grid.append(
    resultField('項目名', entry.item_name),
    resultField('資料ページ', `p.${entry.document_page_number}`),
    resultField('PDFページ', `p.${entry.pdf_page_number}`)
  );

  const actions = document.createElement('div');
  actions.className = 'result-actions';
  const pdfPage = Math.max(1, toNumber(entry.pdf_page_number, 1));
  actions.append(
    pdfLink(doc.pdf_file, pdfPage, `PDF p.${pdfPage}を開く`, true),
    pdfLink(doc.pdf_file, Math.max(1, pdfPage - 1), `前ページ p.${Math.max(1, pdfPage - 1)}`),
    pdfLink(doc.pdf_file, pdfPage + 1, `次ページ p.${pdfPage + 1}`)
  );

  card.append(top, grid, actions);
  return card;
}

function resultField(label, value) {
  const wrapper = document.createElement('div');
  const labelNode = document.createElement('span');
  labelNode.className = 'result-label';
  labelNode.textContent = label;
  const valueNode = document.createElement('span');
  valueNode.className = 'result-value';
  valueNode.textContent = value || '-';
  wrapper.append(labelNode, valueNode);
  return wrapper;
}

function pdfLink(pdfFile, pageNumber, label, isPrimary = false) {
  const link = document.createElement('a');
  link.className = isPrimary ? 'pdf-page-link is-primary' : 'pdf-page-link';
  link.href = `${pdfPath(pdfFile)}#page=${pageNumber}`;
  link.target = '_blank';
  link.rel = 'noopener';
  link.textContent = label;
  return link;
}

async function loadTocEntriesForDocument(doc) {
  try {
    return await loadCsv(`data/toc_entries/${encodeURIComponent(doc.document_id)}.csv`);
  } catch (error) {
    console.warn(`${doc.document_id} の索引CSVを読み込めませんでした。`, error);
    return [];
  }
}

async function init() {
  if (state.initialized) return;
  state.initialized = true;

  try {
    const documents = await loadCsv('data/documents.csv');

    state.documents = documents
      .filter((doc) => doc.enabled === '1')
      .sort(sortByOrder);
    const tocEntryGroups = await Promise.all(
      state.documents.map((doc) => loadTocEntriesForDocument(doc))
    );
    const validDocumentIds = new Set(state.documents.map((doc) => doc.document_id));
    state.tocEntries = tocEntryGroups
      .flat()
      .filter((entry) => validDocumentIds.has(entry.document_id))
      .sort(sortResults);
    state.selectedIds = new Set(state.documents.map((doc) => doc.document_id));
    renderSources();
    runSearch();
  } catch (error) {
    resultSummary.textContent = 'CSVを読み込めませんでした。public/data/ 配下のCSVを確認してください。';
    resultList.textContent = '';
  }
}

function unlockApp() {
  accessGate.hidden = true;
  appShell.hidden = false;
  init();
}

function setupAccessGate() {
  if (sessionStorage.getItem(ACCESS_SESSION_KEY) === '1') {
    unlockApp();
    return;
  }

  accessGate.hidden = false;
  appShell.hidden = true;
  accessPassword.focus();
}

selectAllButton.addEventListener('click', () => {
  state.selectedIds = new Set(state.documents.map((doc) => doc.document_id));
  renderSources();
  runSearch();
});

clearAllButton.addEventListener('click', () => {
  state.selectedIds.clear();
  renderSources();
  runSearch();
});

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  runSearch();
});

accessForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (accessPassword.value === SIMPLE_ACCESS_PASSWORD) {
    sessionStorage.setItem(ACCESS_SESSION_KEY, '1');
    accessPassword.value = '';
    accessError.textContent = '';
    unlockApp();
    return;
  }

  accessError.textContent = 'パスワードが違います';
  accessPassword.select();
});

setupAccessGate();
