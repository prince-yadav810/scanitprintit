async function addPage(src) {
  const sheet = document.createElement('div');
  sheet.className = 'sheet';
  const image = document.createElement('img');
  image.src = src;
  await image.decode();
  sheet.append(image);
  document.body.append(sheet);
}

window.printReady = (async () => {
  const bytes = new Uint8Array(await window.printDocument.read());
  const header = new TextDecoder().decode(bytes.slice(0, 5));
  if (header !== '%PDF-') {
    // Image uploads are also supported by the customer flow.
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    const isPng = bytes[0] === 0x89 && new TextDecoder().decode(bytes.slice(1, 4)) === 'PNG';
    const isWebp = new TextDecoder().decode(bytes.slice(0, 4)) === 'RIFF'
      && new TextDecoder().decode(bytes.slice(8, 12)) === 'WEBP';
    if (!isJpeg && !isPng && !isWebp) throw new Error('Downloaded document is not a PDF or supported image.');
    const url = URL.createObjectURL(new Blob([bytes]));
    try { await addPage(url); } finally { URL.revokeObjectURL(url); }
    return { success: true, pages: 1 };
  }

  const pdfjs = await import('../../node_modules/pdfjs-dist/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL('../../node_modules/pdfjs-dist/build/pdf.worker.mjs', import.meta.url).href;
  const resourceBase = new URL('../../node_modules/pdfjs-dist/', import.meta.url).href;
  const task = pdfjs.getDocument({
    data: bytes,
    isEvalSupported: false,
    cMapUrl: `${resourceBase}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${resourceBase}standard_fonts/`,
  });
  // Password-protected documents must fail instead of waiting for a hidden prompt.
  task.onPassword = updatePassword => updatePassword(new Error('Password-protected PDFs cannot be printed automatically.'));
  try {
    const pdf = await task.promise;
    for (let number = 1; number <= pdf.numPages; number++) {
      const page = await pdf.getPage(number);
      const base = page.getViewport({ scale: 1 });
      // Render at 200 dpi, with a cap for unusually large source pages.
      const scale = Math.min(200 / 72, Math.sqrt(8000000 / (base.width * base.height)));
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      await page.render({ canvasContext: canvas.getContext('2d'), viewport, background: 'white' }).promise;
      await addPage(canvas.toDataURL('image/png'));
      canvas.width = canvas.height = 0;
      page.cleanup();
    }
    await document.fonts.ready;
    // Let Chromium lay out the rendered images before printing.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return { success: true, pages: pdf.numPages };
  } finally {
    await task.destroy();
  }
})().catch(error => ({ success: false, error: error.message }));
