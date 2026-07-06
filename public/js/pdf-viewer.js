import * as pdfjsLib from '../vendor/pdfjs/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'vendor/pdfjs/pdf.worker.mjs';

let pdfDocument = null;
let currentPage = 1;
let currentUrl = '';
let pageChangeCallback = null;

const canvas = document.getElementById('pdf-canvas');
const message = document.getElementById('pdf-message');
const pageStatus = document.getElementById('page-status');
const prevButton = document.getElementById('prev-page');
const nextButton = document.getElementById('next-page');
const openButton = document.getElementById('open-pdf');

function setMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle('is-error', isError);
}

function updateButtons() {
  const total = pdfDocument ? pdfDocument.numPages : 0;
  pageStatus.textContent = total ? `${currentPage} / ${total}` : '- / -';
  prevButton.disabled = !total || currentPage <= 1;
  nextButton.disabled = !total || currentPage >= total;
  openButton.disabled = !currentUrl;
  if (pageChangeCallback) {
    pageChangeCallback({ currentPage, totalPages: total });
  }
}

async function renderPage(pageNumber) {
  if (!pdfDocument) return;
  currentPage = Math.max(1, Math.min(pageNumber, pdfDocument.numPages));
  const page = await pdfDocument.getPage(currentPage);
  const containerWidth = Math.max(260, canvas.parentElement.clientWidth - 32);
  const rawViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(1.35, containerWidth / rawViewport.width);
  const viewport = page.getViewport({ scale });
  const context = canvas.getContext('2d');

  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  await page.render({ canvasContext: context, viewport }).promise;
  setMessage('');
  updateButtons();
}

export async function openPdf({ url, pageNumber }) {
  try {
    setMessage('PDFを読み込んでいます。');
    currentUrl = url;
    pdfDocument = await pdfjsLib.getDocument(url).promise;
    await renderPage(Number(pageNumber) || 1);
  } catch (error) {
    pdfDocument = null;
    currentUrl = '';
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    setMessage('PDFを読み込めませんでした。public/pdfs/ 配下に該当PDFがあるか確認してください。', true);
    updateButtons();
  }
}

export function onPdfPageChange(callback) {
  pageChangeCallback = callback;
}

prevButton.addEventListener('click', () => {
  renderPage(currentPage - 1);
});

nextButton.addEventListener('click', () => {
  renderPage(currentPage + 1);
});

openButton.addEventListener('click', () => {
  if (currentUrl) {
    window.open(`${currentUrl}#page=${currentPage}`, '_blank', 'noopener');
  }
});

updateButtons();
