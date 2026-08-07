// ==========================================
// 附件内容解析：浏览器端提取 txt / Word(doc/docx) / WPS / PDF 附件中的文本，
// 供拜访笔记「上传附件」自动识别填入。
// docx 与 WPS 新格式（zip 容器）走 mammoth；pdf 走 pdfjs；
// doc / wps 老二进制格式做尽力而为的可读文本提取。
// ==========================================

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
const MAX_TEXT_LENGTH = 30000; // 填入笔记的内容上限，超长截断

export interface AttachmentParseResult {
  fileName: string;
  text: string;
  truncated: boolean;
}

/** 按文件头魔数判断容器类型 */
function detectContainer(buf: ArrayBuffer): 'zip' | 'pdf' | 'ole' | 'unknown' {
  const head = new Uint8Array(buf.slice(0, 8));
  if (head[0] === 0x50 && head[1] === 0x4b) return 'zip'; // docx / wps 新格式
  if (head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46) return 'pdf';
  if (head[0] === 0xd0 && head[1] === 0xcf && head[2] === 0x11 && head[3] === 0xe0) return 'ole'; // doc / wps 老格式
  return 'unknown';
}

/** 纯文本解码：优先 UTF-8（含 UTF-16 BOM），失败回退 GB18030（兼容 GBK/GB2312） */
function decodeText(buf: ArrayBuffer): string {
  const head = new Uint8Array(buf.slice(0, 2));
  if (head[0] === 0xff && head[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buf).replace(/^\uFEFF/, '');
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf).replace(/^\uFEFF/, '');
  } catch {
    try {
      return new TextDecoder('gb18030').decode(buf);
    } catch {
      return new TextDecoder().decode(buf);
    }
  }
}

/** docx / WPS 新格式（zip 容器）：mammoth 提取纯文本 */
async function parseDocx(buf: ArrayBuffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ arrayBuffer: buf });
  return result.value;
}

/** PDF：pdfjs 逐页提取文本 */
async function parsePdf(buf: ArrayBuffer): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  const workerMod = await import('pdfjs-dist/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = workerMod.default;
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buf) });
  const doc = await loadingTask.promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let pageText = '';
    for (const item of content.items) {
      if ('str' in item) {
        pageText += item.str;
        if ((item as { hasEOL?: boolean }).hasEOL) pageText += '\n';
      }
    }
    pages.push(pageText.trim());
  }
  await loadingTask.destroy();
  return pages.join('\n');
}

/** doc / wps 老二进制格式：无成熟浏览器解析器，按常见编码尽力提取可读文本段 */
function extractLegacyText(buf: ArrayBuffer): string {
  const TEXT_RUN = /[\u4e00-\u9fff\u3000-\u303f\uff00-\uffefA-Za-z0-9，。、；：""''（）《》【】！？.,;:()\-—/%\s]{8,}/g;
  let best = '';
  for (const enc of ['utf-16le', 'gb18030', 'utf-8']) {
    let raw = '';
    try {
      raw = new TextDecoder(enc).decode(buf);
    } catch {
      continue;
    }
    const runs = (raw.match(TEXT_RUN) || [])
      .map(r => r.replace(/\s{3,}/g, '\n').trim())
      .filter(r => r.length >= 8);
    const text = runs.join('\n');
    if (text.length > best.length) best = text;
  }
  return best;
}

/**
 * 解析附件为纯文本。
 * @throws Error 文件过大或解析失败时抛出，调用方负责提示用户
 */
export async function parseAttachment(file: File): Promise<AttachmentParseResult> {
  if (file.size > MAX_FILE_SIZE) throw new Error('附件超过 20MB，请精简后重新上传');
  if (file.size === 0) throw new Error('附件为空文件');

  const buf = await file.arrayBuffer();
  const container = detectContainer(buf);
  const lowerName = file.name.toLowerCase();

  let text: string;
  if (container === 'zip') {
    // .docx / WPS 保存的 zip 容器文档
    text = await parseDocx(buf);
  } else if (container === 'pdf') {
    text = await parsePdf(buf);
  } else if (/\.(txt|md|csv|log)$/.test(lowerName) || container === 'unknown') {
    // 纯文本类；无法识别容器时也按文本尽力解码
    text = decodeText(buf);
  } else {
    // .doc / .wps 老二进制格式
    text = extractLegacyText(buf);
  }

  text = text.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (!text) throw new Error('未能从附件中识别出可读文本');

  const truncated = text.length > MAX_TEXT_LENGTH;
  return { fileName: file.name, text: text.slice(0, MAX_TEXT_LENGTH), truncated };
}
