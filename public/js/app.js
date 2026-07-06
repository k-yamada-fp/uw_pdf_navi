import { loadCsv } from './csv.js';
import { onPdfPageChange, openPdf } from './pdf-viewer.js';

const state = {
  documents: [],
  tocEntries: [],
  selectedIds: new Set(),
  results: [],
  activeResultKey: '',
  activeEntry: null
};

const sourceList = document.getElementById('source-list');
const selectedCount = document.getElementById('selected-count');
const selectAllButton = document.getElementById('select-all');
const clearAllButton = document.getElementById('clear-all');
const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const resultSummary = document.getElementById('result-summary');
const resultList = document.getElementById('result-list');
const pdfTitle = document.getElementById('pdf-title');
const pdfPages = document.getElementById('pdf-pages');

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function sortByOrder(left, right) {
  return toNumber(left.sort_order, 999999) - toNumber(right.sort_order, 999999);
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
  state.activeResultKey = '';
  state.activeEntry = null;
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
    .sort((left, right) => {
      const docCompare = sortByOrder(getDoc(left.document_id) || {}, getDoc(right.document_id) || {});
      if (docCompare !== 0) return docCompare;
      return sortByOrder(left, right);
    });

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

  state.results.forEach((entry, index) => {
    const doc = getDoc(entry.document_id);
    if (!doc) return;
    const key = `${entry.document_id}:${entry.sort_order}:${entry.item_name}`;
    const card = document.createElement('article');
    card.className = 'result-card';
    if (state.activeResultKey === key) {
      card.classList.add('is-active');
    }

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

    const openButton = document.createElement('button');
    openButton.type = 'button';
    openButton.className = 'open-page';
    openButton.textContent = 'このページを開く';
    openButton.addEventListener('click', (event) => {
      event.stopPropagation();
      openResult(entry, key);
    });

    card.addEventListener('click', () => {
      openResult(entry, key);
    });
    card.append(top, grid, openButton);
    resultList.appendChild(card);

    if (index === 0 && !state.activeResultKey) {
      state.activeResultKey = key;
    }
  });
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

function openResult(entry, key) {
  const doc = getDoc(entry.document_id);
  if (!doc) return;
  state.activeResultKey = key;
  state.activeEntry = entry;
  pdfTitle.textContent = `${doc.company_name}｜${doc.document_name}｜${doc.version_label}`;
  pdfPages.textContent = `資料p.${entry.document_page_number} / PDF p.${entry.pdf_page_number}`;
  renderResults();
  openPdf({
    url: pdfPath(doc.pdf_file),
    pageNumber: toNumber(entry.pdf_page_number, 1)
  });
}

async function init() {
  try {
    const [documents, tocEntries] = await Promise.all([
      loadCsv('data/documents.csv'),
      loadCsv('data/toc_entries.csv')
    ]);

    state.documents = documents
      .filter((doc) => doc.enabled === '1')
      .sort(sortByOrder);
    state.tocEntries = tocEntries.sort(sortByOrder);
    state.selectedIds = new Set(state.documents.map((doc) => doc.document_id));
    renderSources();
    runSearch();
  } catch (error) {
    resultSummary.textContent = 'CSVを読み込めませんでした。public/data/ 配下のCSVを確認してください。';
    resultList.textContent = '';
  }
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

onPdfPageChange(({ currentPage }) => {
  if (state.activeEntry) {
    pdfPages.textContent = `資料p.${state.activeEntry.document_page_number} / PDF p.${currentPage}`;
  }
});

init();
