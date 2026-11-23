/**
 * Mobile Client-Side PDF Engine for PDF Studio Pro
 * 100% Offline execution using PDF-Lib and PDF.js in Android WebView
 */

const { PDFDocument, rgb, degrees, StandardFonts } = PDFLib;

// Configure PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/pdf.worker.min.js';
}

const MobileEngine = {

  // Trigger file download (Native Android or Browser)
  saveFile: function(uint8Array, filename, mimeType = 'application/pdf') {
    let binary = '';
    const len = uint8Array.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const base64Data = window.btoa(binary);

    if (window.AndroidBridge && window.AndroidBridge.saveBase64File) {
      window.AndroidBridge.saveBase64File(base64Data, filename, mimeType);
    } else {
      // Fallback for standard browser
      const blob = new Blob([uint8Array], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 500);
    }
    return base64Data;
  },

  // Helper to read File as ArrayBuffer
  readFileAsArrayBuffer: function(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsArrayBuffer(file);
    });
  },

  // Helper to parse hex color to pdf-lib rgb
  hexToRgb: function(hex) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
      hex = hex.split('').map(c => c + c).join('');
    }
    const num = parseInt(hex, 16);
    return rgb((num >> 16) / 255, ((num >> 8) & 255) / 255, (num & 255) / 255);
  },

  // 1. Images to PDF
  imagesToPdf: async function(imageFiles, pageSize = 'fit', orientation = 'auto', margin = 0) {
    const pdfDoc = await PDFDocument.create();

    for (const imgFile of imageFiles) {
      const imgBuffer = await this.readFileAsArrayBuffer(imgFile);
      let embeddedImg;
      const isPng = imgFile.type.includes('png') || imgFile.name.toLowerCase().endsWith('.png');
      if (isPng) {
        embeddedImg = await pdfDoc.embedPng(imgBuffer);
      } else {
        embeddedImg = await pdfDoc.embedJpg(imgBuffer);
      }

      const imgWidth = embeddedImg.width;
      const imgHeight = embeddedImg.height;

      let pageWidth, pageHeight;
      if (pageSize === 'A4') {
        const isLandscape = orientation === 'landscape' || (orientation === 'auto' && imgWidth > imgHeight);
        pageWidth = isLandscape ? 841.89 : 595.28;
        pageHeight = isLandscape ? 595.28 : 841.89;
      } else {
        pageWidth = imgWidth + (margin * 2);
        pageHeight = imgHeight + (margin * 2);
      }

      const page = pdfDoc.addPage([pageWidth, pageHeight]);
      const availableW = pageWidth - (margin * 2);
      const availableH = pageHeight - (margin * 2);
      const scale = Math.min(availableW / imgWidth, availableH / imgHeight, 1);

      const renderW = imgWidth * scale;
      const renderH = imgHeight * scale;
      const x = (pageWidth - renderW) / 2;
      const y = (pageHeight - renderH) / 2;

      page.drawImage(embeddedImg, { x, y, width: renderW, height: renderH });
    }

    return await pdfDoc.save();
  },

  // 2. Organize & Merge
  organizePdf: async function(pagesInstruction) {
    const pdfDoc = await PDFDocument.create();
    const loadedDocs = new Map();

    for (const inst of pagesInstruction) {
      let srcDoc = loadedDocs.get(inst.file);
      if (!srcDoc) {
        const buf = await this.readFileAsArrayBuffer(inst.file);
        srcDoc = await PDFDocument.load(buf);
        loadedDocs.set(inst.file, srcDoc);
      }

      const [copiedPage] = await pdfDoc.copyPages(srcDoc, [inst.pageIndex]);
      if (inst.rotation) {
        copiedPage.setRotation(degrees((copiedPage.getRotation().angle + inst.rotation) % 360));
      }
      pdfDoc.addPage(copiedPage);
    }

    return await pdfDoc.save();
  },

  // 3. Watermark
  watermarkPdf: async function(pdfFile, text, fontSize = 45, colorHex = '#dc2626', opacity = 0.25, rotationDeg = 45) {
    const buf = await this.readFileAsArrayBuffer(pdfFile);
    const pdfDoc = await PDFDocument.load(buf);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const color = this.hexToRgb(colorHex);

    const pages = pdfDoc.getPages();
    for (const page of pages) {
      const { width, height } = page.getSize();
      const textWidth = font.widthOfTextAtSize(text, fontSize);
      const textHeight = font.heightAtSize(fontSize);

      page.drawText(text, {
        x: (width - textWidth) / 2,
        y: (height - textHeight) / 2,
        size: fontSize,
        font: font,
        color: color,
        opacity: opacity,
        rotate: degrees(rotationDeg)
      });
    }

    return await pdfDoc.save();
  },

  // 4. Page Numbers
  pageNumbersPdf: async function(pdfFile, formatStr = 'Page {n} / {total}', position = 'bottom-right', startAt = 1) {
    const buf = await this.readFileAsArrayBuffer(pdfFile);
    const pdfDoc = await PDFDocument.load(buf);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    const total = pages.length;

    pages.forEach((page, idx) => {
      const current = startAt + idx;
      const numStr = formatStr.replace('{n}', current).replace('{total}', total);
      const { width, height } = page.getSize();
      const fontSize = 10;
      const textWidth = font.widthOfTextAtSize(numStr, fontSize);
      const margin = 35;

      let x = width - textWidth - margin;
      let y = margin;

      if (position === 'bottom-center') x = (width - textWidth) / 2;
      else if (position === 'bottom-left') x = margin;
      else if (position === 'top-right') { x = width - textWidth - margin; y = height - margin; }
      else if (position === 'top-center') { x = (width - textWidth) / 2; y = height - margin; }

      page.drawText(numStr, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0.2, 0.2, 0.2)
      });
    });

    return await pdfDoc.save();
  },

  // 5. Bates Stamping
  batesStamping: async function(pdfFile, prefix = 'PIECE-', digits = 5, start = 1, position = 'bottom-right') {
    const buf = await this.readFileAsArrayBuffer(pdfFile);
    const pdfDoc = await PDFDocument.load(buf);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const pages = pdfDoc.getPages();

    pages.forEach((page, idx) => {
      const num = start + idx;
      const numStr = prefix + String(num).padStart(digits, '0');
      const { width, height } = page.getSize();
      const fontSize = 10;
      const textWidth = font.widthOfTextAtSize(numStr, fontSize);
      const margin = 35;

      let x = width - textWidth - margin;
      let y = margin;
      if (position === 'bottom-center') x = (width - textWidth) / 2;
      else if (position === 'top-right') { x = width - textWidth - margin; y = height - margin; }
      else if (position === 'top-center') { x = (width - textWidth) / 2; y = height - margin; }

      page.drawText(numStr, {
        x,
        y,
        size: fontSize,
        font,
        color: rgb(0.15, 0.15, 0.15)
      });
    });

    return await pdfDoc.save();
  },

  // 6. Split PDF
  splitPdf: async function(pdfFile, rangesStr) {
    const buf = await this.readFileAsArrayBuffer(pdfFile);
    const srcDoc = await PDFDocument.load(buf);
    const totalPages = srcDoc.getPageCount();

    const newDoc = await PDFDocument.create();
    let pageIndices = [];

    if (rangesStr.trim().toLowerCase() === 'all') {
      pageIndices = Array.from({ length: totalPages }, (_, i) => i);
    } else {
      rangesStr.split(',').forEach(part => {
        part = part.trim();
        if (part.includes('-')) {
          const [s, e] = part.split('-').map(Number);
          for (let i = s; i <= e; i++) {
            if (i >= 1 && i <= totalPages) pageIndices.push(i - 1);
          }
        } else {
          const p = Number(part);
          if (p >= 1 && p <= totalPages) pageIndices.push(p - 1);
        }
      });
    }

    const copiedPages = await newDoc.copyPages(srcDoc, pageIndices);
    copiedPages.forEach(p => newDoc.addPage(p));

    return await newDoc.save();
  },

  // 7. Remove Pages
  removePages: async function(pdfFile, pagesToRemoveStr) {
    const buf = await this.readFileAsArrayBuffer(pdfFile);
    const srcDoc = await PDFDocument.load(buf);
    const totalPages = srcDoc.getPageCount();

    const toDelete = new Set();
    pagesToRemoveStr.split(',').forEach(part => {
      part = part.trim();
      if (part.includes('-')) {
        const [s, e] = part.split('-').map(Number);
        for (let i = s; i <= e; i++) {
          if (i >= 1 && i <= totalPages) toDelete.add(i - 1);
        }
      } else {
        const p = Number(part);
        if (p >= 1 && p <= totalPages) toDelete.add(p - 1);
      }
    });

    const keepIndices = [];
    for (let i = 0; i < totalPages; i++) {
      if (!toDelete.has(i)) keepIndices.push(i);
    }

    if (keepIndices.length === 0) {
      throw new Error("Impossible de supprimer toutes les pages du document.");
    }

    const newDoc = await PDFDocument.create();
    const copiedPages = await newDoc.copyPages(srcDoc, keepIndices);
    copiedPages.forEach(p => newDoc.addPage(p));

    return await newDoc.save();
  },

  // 8. Flatten PDF
  flattenPdf: async function(pdfFile) {
    const buf = await this.readFileAsArrayBuffer(pdfFile);
    const pdfDoc = await PDFDocument.load(buf);
    const form = pdfDoc.getForm();
    if (form) {
      try {
        form.flatten();
      } catch (e) {
        console.warn('No AcroForm fields to flatten');
      }
    }
    return await pdfDoc.save();
  },

  // 9. Fast Rotate
  rotateFast: async function(pdfFile, angle = 90, pagesMode = 'all') {
    const buf = await this.readFileAsArrayBuffer(pdfFile);
    const pdfDoc = await PDFDocument.load(buf);
    const pages = pdfDoc.getPages();

    pages.forEach((page, idx) => {
      let apply = false;
      if (pagesMode === 'all') apply = true;
      else if (pagesMode === 'odd' && idx % 2 === 0) apply = true;
      else if (pagesMode === 'even' && idx % 2 === 1) apply = true;

      if (apply) {
        page.setRotation(degrees((page.getRotation().angle + angle) % 360));
      }
    });

    return await pdfDoc.save();
  },

  // 10. Metadata & GDPR Sanitizer
  getMetadata: async function(pdfFile) {
    const buf = await this.readFileAsArrayBuffer(pdfFile);
    const pdfDoc = await PDFDocument.load(buf);
    return {
      title: pdfDoc.getTitle() || '',
      author: pdfDoc.getAuthor() || '',
      subject: pdfDoc.getSubject() || '',
      keywords: (pdfDoc.getKeywords() || []).join(', '),
      creator: pdfDoc.getCreator() || '',
      producer: pdfDoc.getProducer() || '',
      page_count: pdfDoc.getPageCount()
    };
  },

  updateMetadata: async function(pdfFile, metadata, sanitize = false) {
    const buf = await this.readFileAsArrayBuffer(pdfFile);
    const pdfDoc = await PDFDocument.load(buf);

    if (sanitize) {
      pdfDoc.setTitle('');
      pdfDoc.setAuthor('');
      pdfDoc.setSubject('');
      pdfDoc.setKeywords([]);
      pdfDoc.setProducer('');
      pdfDoc.setCreator('');
    } else {
      if (metadata.title !== undefined) pdfDoc.setTitle(metadata.title);
      if (metadata.author !== undefined) pdfDoc.setAuthor(metadata.author);
      if (metadata.subject !== undefined) pdfDoc.setSubject(metadata.subject);
      if (metadata.keywords !== undefined) {
        pdfDoc.setKeywords(metadata.keywords.split(',').map(s => s.trim()).filter(Boolean));
      }
      if (metadata.creator !== undefined) pdfDoc.setCreator(metadata.creator);
    }

    return await pdfDoc.save();
  },

  // 11. Extract Text & Markdown via PDF.js
  extractTextOrMarkdown: async function(pdfFile, fmt = 'txt') {
    const buf = await this.readFileAsArrayBuffer(pdfFile);
    const loadingTask = pdfjsLib.getDocument({ data: buf });
    const pdf = await loadingTask.promise;

    let output = '';
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items.map(item => item.str).join(' ');

      if (fmt === 'md') {
        output += `## Page ${pageNum}\n\n${pageText}\n\n---\n\n`;
      } else {
        output += `--- Page ${pageNum} ---\n\n${pageText}\n\n`;
      }
    }

    return output;
  },

  // 12. PDF to Images (Render pages to PNGs via PDF.js)
  pdfToImages: async function(pdfFile, scale = 2.0) {
    const buf = await this.readFileAsArrayBuffer(pdfFile);
    const loadingTask = pdfjsLib.getDocument({ data: buf });
    const pdf = await loadingTask.promise;

    const pages = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale });
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: context, viewport }).promise;
      const dataUrl = canvas.toDataURL('image/png');
      pages.push({
        page_number: pageNum,
        thumbnail: dataUrl,
        file_name: `page_${pageNum}.png`,
        dataUrl: dataUrl
      });
    }

    return pages;
  }
};
