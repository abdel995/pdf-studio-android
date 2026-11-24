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
  },

  // 13. Batch Images to PDF (Merge or Separate ZIP)
  batchImagesToPdf: async function(imageFiles, pageSize = 'fit', orientation = 'auto', margin = 0, mergeSingle = true) {
    if (mergeSingle || imageFiles.length === 1) {
      return {
        bytes: await this.imagesToPdf(imageFiles, pageSize, orientation, margin),
        isZip: false
      };
    } else {
      const zip = new JSZip();
      for (let i = 0; i < imageFiles.length; i++) {
        const img = imageFiles[i];
        const baseName = img.name.substring(0, img.name.lastIndexOf('.')) || `image_${i+1}`;
        const singlePdfBytes = await this.imagesToPdf([img], pageSize, orientation, margin);
        zip.file(`${baseName}.pdf`, singlePdfBytes);
      }
      const zipBytes = await zip.generateAsync({ type: 'uint8array' });
      return {
        bytes: zipBytes,
        isZip: true
      };
    }
  },

  // 14. Batch PDF to Images (Multiple PDFs to ZIP)
  batchPdfToImages: async function(pdfFiles, scale = 2.0) {
    const zip = new JSZip();
    const allGalleryPages = [];

    for (let fIdx = 0; fIdx < pdfFiles.length; fIdx++) {
      const pdfFile = pdfFiles[fIdx];
      const baseName = pdfFile.name.substring(0, pdfFile.name.lastIndexOf('.')) || `doc_${fIdx+1}`;
      const pages = await this.pdfToImages(pdfFile, scale);

      pages.forEach(p => {
        allGalleryPages.push({
          ...p,
          file_name: `${baseName}_p${p.page_number}.png`
        });
        const base64Data = p.dataUrl.split(',')[1];
        zip.file(`${baseName}_p${p.page_number}.png`, base64Data, { base64: true });
      });
    }

    const zipBytes = await zip.generateAsync({ type: 'uint8array' });
    return {
      pages: allGalleryPages,
      zipBytes: zipBytes
    };
  },

  // 15. Word (.docx) to PDF (100% Offline Canvas-Powered Engine with Full Unicode & Arabic RTL Support)
  wordToPdf: async function(docxFile) {
    const buffer = await this.readFileAsArrayBuffer(docxFile);
    let zip;
    try {
      zip = await JSZip.loadAsync(buffer);
    } catch (e) {
      throw new Error("Impossible d'ouvrir le fichier Word (.docx). Assurez-vous qu'il s'agit d'un document Word valide.");
    }

    const docXmlFile = zip.file("word/document.xml");
    if (!docXmlFile) {
      throw new Error("Format .docx non reconnu (word/document.xml introuvable).");
    }

    const xmlStr = await docXmlFile.async("string");
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlStr, "text/xml");

    const pdfDoc = await PDFDocument.create();

    // Canvas-based A4 Page Renderer (150 DPI: 1240 x 1754 px)
    const a4Width = 1240;
    const a4Height = 1754;
    const pdfWidth = 595.28;
    const pdfHeight = 841.89;
    const marginX = 85;
    const marginTop = 95;
    const marginBottom = 95;
    const contentWidth = a4Width - (marginX * 2);

    let canvas = document.createElement('canvas');
    canvas.width = a4Width;
    canvas.height = a4Height;
    let ctx = canvas.getContext('2d');
    let hasContentOnPage = false;

    const resetCanvas = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, a4Width, a4Height);
    };
    resetCanvas();

    let curY = marginTop;

    const commitPage = async () => {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
      const img = await pdfDoc.embedJpg(dataUrl);
      const page = pdfDoc.addPage([pdfWidth, pdfHeight]);
      page.drawImage(img, { x: 0, y: 0, width: pdfWidth, height: pdfHeight });

      canvas = document.createElement('canvas');
      canvas.width = a4Width;
      canvas.height = a4Height;
      ctx = canvas.getContext('2d');
      resetCanvas();
      curY = marginTop;
      hasContentOnPage = false;
    };

    // Helper to wrap and draw text onto canvas with full RTL / Unicode support
    const drawCanvasText = async (text, fontSize, isBold, isRtl, isHeading = false) => {
      const fontName = isRtl
        ? '"Noto Sans Arabic", "Cairo", "Segoe UI", Tahoma, Arial, sans-serif'
        : 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", Arial, sans-serif';

      ctx.font = `${isBold ? 'bold ' : ''}${fontSize}px ${fontName}`;
      ctx.fillStyle = isHeading ? '#0f172a' : '#1e293b';

      const lineHeight = Math.round(fontSize * 1.45);
      const words = text.split(/\s+/);
      let line = '';

      for (let n = 0; n < words.length; n++) {
        const testLine = line ? `${line} ${words[n]}` : words[n];
        const metrics = ctx.measureText(testLine);
        if (metrics.width > contentWidth && line) {
          if (curY + lineHeight > a4Height - marginBottom) {
            await commitPage();
            ctx.font = `${isBold ? 'bold ' : ''}${fontSize}px ${fontName}`;
            ctx.fillStyle = isHeading ? '#0f172a' : '#1e293b';
          }
          if (isRtl) {
            ctx.textAlign = 'right';
            ctx.fillText(line, a4Width - marginX, curY);
          } else {
            ctx.textAlign = 'left';
            ctx.fillText(line, marginX, curY);
          }
          hasContentOnPage = true;
          curY += lineHeight;
          line = words[n];
        } else {
          line = testLine;
        }
      }

      if (line) {
        if (curY + lineHeight > a4Height - marginBottom) {
          await commitPage();
          ctx.font = `${isBold ? 'bold ' : ''}${fontSize}px ${fontName}`;
          ctx.fillStyle = isHeading ? '#0f172a' : '#1e293b';
        }
        if (isRtl) {
          ctx.textAlign = 'right';
          ctx.fillText(line, a4Width - marginX, curY);
        } else {
          ctx.textAlign = 'left';
          ctx.fillText(line, marginX, curY);
        }
        hasContentOnPage = true;
        curY += lineHeight;
      }
    };

    // Parse XML body child elements in sequence
    const bodyNode = xmlDoc.querySelector("w\\:body, body");
    if (!bodyNode) {
      throw new Error("Structure du document Word invalide (<w:body> manquant).");
    }

    const children = bodyNode.childNodes;
    for (let c = 0; c < children.length; c++) {
      const child = children[c];
      const nodeName = (child.nodeName || '').toLowerCase();

      // PARAGRAPH
      if (nodeName.endsWith('p')) {
        // Page break
        const pageBr = child.querySelector("w\\:br[w\\:type='page'], br[type='page']");
        if (pageBr) {
          if (hasContentOnPage) await commitPage();
        }

        const pStyle = child.querySelector("w\\:pStyle, pStyle");
        const styleVal = pStyle ? (pStyle.getAttribute("w:val") || pStyle.getAttribute("val") || "") : "";
        const isHeading1 = /heading\s*1|titre\s*1/i.test(styleVal);
        const isHeading2 = /heading\s*2|titre\s*2/i.test(styleVal);
        const isHeading3 = /heading\s*3|titre\s*3/i.test(styleVal);

        let pText = "";
        let hasBold = false;
        const runs = child.getElementsByTagName("w:r");
        for (let r = 0; r < runs.length; r++) {
          const run = runs[r];
          if (run.querySelector("w\\:b, b")) hasBold = true;
          const textNodes = run.getElementsByTagName("w:t");
          for (let t = 0; t < textNodes.length; t++) {
            pText += textNodes[t].textContent;
          }
        }
        pText = pText.trim();
        if (!pText) {
          curY += 14;
          if (curY > a4Height - marginBottom && hasContentOnPage) await commitPage();
          continue;
        }

        const isArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(pText);

        if (isHeading1) {
          curY += 14;
          await drawCanvasText(pText, 34, true, isArabic, true);
          curY += 12;
        } else if (isHeading2) {
          curY += 10;
          await drawCanvasText(pText, 28, true, isArabic, true);
          curY += 8;
        } else if (isHeading3) {
          curY += 8;
          await drawCanvasText(pText, 24, true, isArabic, true);
          curY += 6;
        } else {
          const isLikelyTitle = (pText.length < 60 && hasBold && !pText.endsWith('.'));
          const fSize = isLikelyTitle ? 24 : 20;
          await drawCanvasText(pText, fSize, hasBold || isLikelyTitle, isArabic, isLikelyTitle);
          curY += 8;
        }
      }

      // TABLE
      else if (nodeName.endsWith('tbl')) {
        const rows = child.getElementsByTagName("w:tr");
        if (rows.length === 0) continue;

        curY += 12;
        const colCount = Math.max(...Array.from(rows).map(r => r.getElementsByTagName("w:tc").length));
        if (colCount === 0) continue;

        const cellWidth = Math.floor(contentWidth / colCount);
        const cellPadding = 12;

        for (let r = 0; r < rows.length; r++) {
          const cells = rows[r].getElementsByTagName("w:tc");
          let maxCellHeight = 44;

          const cellTexts = [];
          for (let col = 0; col < cells.length; col++) {
            const cellText = Array.from(cells[col].getElementsByTagName("w:t")).map(t => t.textContent).join(" ").trim();
            cellTexts.push(cellText);
          }

          if (curY + maxCellHeight > a4Height - marginBottom) {
            await commitPage();
          }

          for (let col = 0; col < cellTexts.length; col++) {
            const x = marginX + (col * cellWidth);
            const isHeaderRow = (r === 0);

            ctx.fillStyle = isHeaderRow ? '#f1f5f9' : '#ffffff';
            ctx.fillRect(x, curY, cellWidth, maxCellHeight);
            ctx.strokeStyle = '#cbd5e1';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, curY, cellWidth, maxCellHeight);

            const txt = cellTexts[col];
            if (txt) {
              const isAr = /[\u0600-\u06FF]/.test(txt);
              ctx.font = `${isHeaderRow ? 'bold ' : ''}18px system-ui, sans-serif`;
              ctx.fillStyle = isHeaderRow ? '#0f172a' : '#334155';
              ctx.textAlign = isAr ? 'right' : 'left';
              const textX = isAr ? (x + cellWidth - cellPadding) : (x + cellPadding);
              ctx.fillText(txt, textX, curY + 28, cellWidth - (cellPadding * 2));
            }
          }
          curY += maxCellHeight;
          hasContentOnPage = true;
        }
        curY += 16;
      }
    }

    if (hasContentOnPage || pdfDoc.getPageCount() === 0) {
      await commitPage();
    }

    return await pdfDoc.save();
  },

  // 16. Batch Word to PDF
  batchWordToPdf: async function(docxFiles, mergeSingle = true) {
    if (mergeSingle || docxFiles.length === 1) {
      const mergedPdf = await PDFDocument.create();
      for (let i = 0; i < docxFiles.length; i++) {
        const singleBytes = await this.wordToPdf(docxFiles[i]);
        const subDoc = await PDFDocument.load(singleBytes);
        const copiedPages = await mergedPdf.copyPages(subDoc, subDoc.getPageIndices());
        copiedPages.forEach(p => mergedPdf.addPage(p));
      }
      return {
        bytes: await mergedPdf.save(),
        isZip: false
      };
    } else {
      const zip = new JSZip();
      for (let i = 0; i < docxFiles.length; i++) {
        const f = docxFiles[i];
        const baseName = f.name.substring(0, f.name.lastIndexOf('.')) || `doc_${i+1}`;
        const pdfBytes = await this.wordToPdf(f);
        zip.file(`${baseName}.pdf`, pdfBytes);
      }
      const zipBytes = await zip.generateAsync({ type: 'uint8array' });
      return {
        bytes: zipBytes,
        isZip: true
      };
    }
  },

  // 17. PDF to Word (.docx) (100% Offline Client-Side Engine)
  pdfToWord: async function(pdfFile) {
    const buffer = await this.readFileAsArrayBuffer(pdfFile);
    const pdfData = new Uint8Array(buffer);
    const pdf = await pdfjsLib.getDocument({ data: pdfData }).promise;
    const numPages = pdf.numPages;

    let bodyXml = "";

    const escapeXml = (str) => {
      return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
    };

    for (let pNum = 1; pNum <= numPages; pNum++) {
      if (pNum > 1) {
        bodyXml += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
      }

      const page = await pdf.getPage(pNum);
      const textContent = await page.getTextContent();
      const items = textContent.items || [];

      if (items.length === 0) continue;

      // Group items into lines by y-coordinate
      const lines = [];
      let currentLine = [];
      let lastY = null;

      items.sort((a, b) => {
        const yDiff = b.transform[5] - a.transform[5];
        if (Math.abs(yDiff) > 3) return yDiff;
        return a.transform[4] - b.transform[4];
      });

      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        const str = it.str || "";
        if (!str.trim() && str !== " ") continue;
        const curY = it.transform[5];

        if (lastY !== null && Math.abs(curY - lastY) > 5) {
          if (currentLine.length > 0) {
            lines.push(currentLine);
            currentLine = [];
          }
        }
        currentLine.push(it);
        lastY = curY;
      }
      if (currentLine.length > 0) lines.push(currentLine);

      // Build paragraphs from lines
      for (let lIdx = 0; lIdx < lines.length; lIdx++) {
        const lineItems = lines[lIdx];
        const lineText = lineItems.map(it => it.str).join(" ").trim();
        if (!lineText) continue;

        const maxFontHeight = Math.max(...lineItems.map(it => Math.abs(it.height || it.transform[0] || 11)));
        const isHeading = maxFontHeight >= 14 || (lineText.length < 60 && maxFontHeight >= 12 && !lineText.endsWith('.'));
        const isArabic = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF]/.test(lineText);

        const pPr = isArabic ? '<w:pPr><w:bidi/></w:pPr>' : '';
        const rPr = (isArabic ? '<w:rtl/>' : '') + (isHeading ? '<w:b/><w:sz w:val="28"/>' : '<w:sz w:val="22"/>');

        bodyXml += `<w:p>${pPr}<w:r><w:rPr>${rPr}</w:rPr><w:t xml:space="preserve">${escapeXml(lineText)}</w:t></w:r></w:p>`;
      }
    }

    // Wrap in full standard DOCX package
    const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

    const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

    const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${bodyXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

    const zip = new JSZip();
    zip.file("[Content_Types].xml", contentTypesXml);
    zip.file("_rels/.rels", relsXml);
    zip.file("word/document.xml", documentXml);

    return await zip.generateAsync({ type: 'uint8array' });
  },

  // 18. Batch PDF to Word
  batchPdfToWord: async function(pdfFiles, mergeSingle = false) {
    if (mergeSingle || pdfFiles.length === 1) {
      if (pdfFiles.length === 1) {
        return {
          bytes: await this.pdfToWord(pdfFiles[0]),
          isZip: false
        };
      }
      let allBodyXml = "";
      for (let i = 0; i < pdfFiles.length; i++) {
        if (i > 0) {
          allBodyXml += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
        }
        allBodyXml += `<w:p><w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t xml:space="preserve">Document : ${escapeXml(pdfFiles[i].name)}</w:t></w:r></w:p>`;
        
        const singleBytes = await this.pdfToWord(pdfFiles[i]);
        const singleZip = await JSZip.loadAsync(singleBytes);
        const singleXml = await singleZip.file("word/document.xml").async("string");
        const match = singleXml.match(/<w:body>([\s\S]*?)<w:sectPr/);
        if (match) {
          allBodyXml += match[1];
        }
      }

      const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

      const relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

      const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${allBodyXml}
    <w:sectPr>
      <w:pgSz w:w="11906" w:h="16838"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/>
    </w:sectPr>
  </w:body>
</w:document>`;

      const zip = new JSZip();
      zip.file("[Content_Types].xml", contentTypesXml);
      zip.file("_rels/.rels", relsXml);
      zip.file("word/document.xml", documentXml);

      return {
        bytes: await zip.generateAsync({ type: 'uint8array' }),
        isZip: false
      };
    } else {
      const zip = new JSZip();
      for (let i = 0; i < pdfFiles.length; i++) {
        const f = pdfFiles[i];
        const baseName = f.name.substring(0, f.name.lastIndexOf('.')) || `doc_${i+1}`;
        const docxBytes = await this.pdfToWord(f);
        zip.file(`${baseName}.docx`, docxBytes);
      }
      return {
        bytes: await zip.generateAsync({ type: 'uint8array' }),
        isZip: true
      };
    }
  }
};
