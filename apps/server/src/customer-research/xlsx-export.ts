// @ts-nocheck -- 移植自 customer-research-backend 的零依赖纯 JS 模块（v1 保留原样，后续逐步补全类型）
// 免依赖生成合法 .xlsx（多 Sheet），供"导出 Excel"使用。
// 由 src/report-export.js 的 buildReportRows 复用同一份 [Section,Field,Value] 提取，
// 按业务分组映射为多个工作表，避免 30+ 张零散 Sheet。单元格用内联字符串（inlineStr），
// 无需 sharedStrings；表头加粗（styles.xml 中 cellXfs 索引 1）。

import { buildReportRows } from './report-export.js';
import { zipStore } from './zip-store.js';

// 业务分组：每张工作表对应一组 Section；避免单 Sheet 过长或 Sheet 过多。
const SHEET_GROUPS = [
  { name: '概览', sections: ['Meta', 'Summary'] },
  { name: '事实与推断', sections: ['Fact', 'Inference', 'Unknown', 'Opportunity', 'Contact'] },
  { name: '公司档案', sections: ['Profile', 'Registry', 'Legal', 'Reputation'] },
  { name: '匹配与人员', sections: ['MatchDimension', 'Strength', 'NextStep', 'WhiteSpaceGap', 'KeyPerson'] },
  { name: '业务与财务', sections: ['Product', 'BusinessLine', 'RevenueStream', 'Milestone', 'CustomerContract', 'Supplier', 'Subsidiary', 'Financial', 'Strategy', 'OperationalMetric'] },
  { name: '风险与证据', sections: ['Risk', 'Litigation', 'Discrepancy', 'Evidence', 'VerificationChecklist'] }
];

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
<borders count="1"><border/></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;

function xmlEscape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// 0-based 列索引 → 列字母（A, B, ..., Z, AA, ...）
function colLetter(idx) {
  let s = '';
  let n = idx;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

// 单元格：表头加粗（s="1"），数值型直接 <v>，其余内联字符串。
function cellXml(ref, value, isHeader) {
  const style = isHeader ? ' s="1"' : '';
  if (!isHeader && value !== '' && value != null) {
    const num = Number(value);
    if (Number.isFinite(num) && !/^\s|\s$/.test(String(value))) {
      return `<c r="${ref}"${style}><v>${num}</v></c>`;
    }
  }
  return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`;
}

function sheetXml(rows) {
  let out = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  out += '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
  rows.forEach((cells, ri) => {
    const r = ri + 1;
    out += `<row r="${r}">`;
    cells.forEach((cell, ci) => {
      out += cellXml(`${colLetter(ci)}${r}`, cell, ri === 0);
    });
    out += '</row>';
  });
  out += '</sheetData></worksheet>';
  return out;
}

function safeSheetName(name) {
  let n = String(name).replace(/[:\\/?*\[\]]/g, ' ').trim();
  if (!n) n = 'Sheet';
  if (n.length > 31) n = n.slice(0, 31);
  return n;
}

// 生成完整 .xlsx 的 Buffer
export function buildReportXlsx(run) {
  const allRows = buildReportRows(run);
  const sheets = SHEET_GROUPS
    .map((g) => {
      const data = allRows.filter(([sec]) => g.sections.includes(sec));
      const rows = [['类型', '字段', '内容'], ...data.map(([sec, field, val]) => [sec, field, val])];
      return { name: g.name, rows };
    })
    .filter((g) => g.rows.length > 1); // 无数据的工作表不导出

  const sheetXmls = sheets.map((s) => sheetXml(s.rows));

  // [Content_Types].xml
  let ct = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">';
  ct += '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>';
  ct += '<Default Extension="xml" ContentType="application/xml"/>';
  ct += '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>';
  sheetXmls.forEach((_, i) => {
    ct += `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`;
  });
  ct += '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>';
  ct += '</Types>';

  // _rels/.rels
  const rootRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';

  // xl/workbook.xml
  let wb = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>';
  sheets.forEach((s, i) => {
    wb += `<sheet name="${xmlEscape(safeSheetName(s.name))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`;
  });
  wb += '</sheets></workbook>';

  // xl/_rels/workbook.xml.rels
  let wbRels = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">';
  sheetXmls.forEach((_, i) => {
    wbRels += `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`;
  });
  wbRels += '<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
  wbRels += '</Relationships>';

  const files = [
    { name: '[Content_Types].xml', data: Buffer.from(ct, 'utf-8') },
    { name: '_rels/.rels', data: Buffer.from(rootRels, 'utf-8') },
    { name: 'xl/workbook.xml', data: Buffer.from(wb, 'utf-8') },
    { name: 'xl/_rels/workbook.xml.rels', data: Buffer.from(wbRels, 'utf-8') },
    { name: 'xl/styles.xml', data: Buffer.from(STYLES_XML, 'utf-8') }
  ];
  sheetXmls.forEach((sx, i) => {
    files.push({ name: `xl/worksheets/sheet${i + 1}.xml`, data: Buffer.from(sx, 'utf-8') });
  });

  return zipStore(files);
}
