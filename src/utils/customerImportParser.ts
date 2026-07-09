import * as XLSX from 'xlsx';
import { formatNumberAsPhone, isValidEmail, normalizePhone } from './phoneValidation';

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls'] as const;

export const CUSTOMER_IMPORT_HEADERS = ['Name', 'Phone', 'Email', 'Tags'] as const;

export const CUSTOMER_IMPORT_SAMPLE_ROW = [
  'Acme Corp',
  '+919998912345',
  'contact@acme.com',
  'VIP;Enterprise',
];

export interface ImportRowValidation {
  rowIndex: number;
  name: string;
  phone: string;
  email: string;
  tags: string;
  errors: string[];
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function forceTextCells(sheet: XLSX.WorkSheet, columnIndex: number, rowCount: number) {
  for (let r = 0; r < rowCount; r++) {
    const ref = XLSX.utils.encode_cell({ r, c: columnIndex });
    const cell = sheet[ref];
    if (!cell) continue;
    sheet[ref] = { t: 's', v: String(cell.v ?? cell.w ?? '') };
  }
}

export function downloadCustomerImportTemplate(format: 'csv' | 'xlsx') {
  const rows = [Array.from(CUSTOMER_IMPORT_HEADERS), Array.from(CUSTOMER_IMPORT_SAMPLE_ROW)];

  if (format === 'csv') {
    const csv = rows
      .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
      .join('\r\n');
    triggerDownload(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }), 'customer-import-template.csv');
    return;
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  forceTextCells(sheet, 1, rows.length);
  sheet['!cols'] = [{ wch: 24 }, { wch: 20 }, { wch: 28 }, { wch: 20 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Customers');
  XLSX.writeFile(workbook, 'customer-import-template.xlsx');
}

export function customerImportTemplateCsvText(): string {
  return [CUSTOMER_IMPORT_HEADERS.join(','), CUSTOMER_IMPORT_SAMPLE_ROW.join(',')].join('\n');
}

export function isAcceptedImportFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some(ext => lower.endsWith(ext));
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

export function parseCsvText(text: string): string[][] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);

  return lines.map(parseCsvLine);
}

function isPhoneHeader(header: string): boolean {
  const normalized = header.toLowerCase().replace(/[\s_-]+/g, '');
  return ['phone', 'mobile', 'whatsapp', 'tel', 'contactnumber', 'phonenumber'].some(key =>
    normalized.includes(key)
  );
}

function cellToImportString(cell: XLSX.CellObject | undefined, isPhoneColumn: boolean): string {
  if (!cell) return '';

  if (cell.t === 's') {
    return String(cell.v ?? '').trim();
  }

  if (cell.t === 'n' && typeof cell.v === 'number') {
    return isPhoneColumn ? formatNumberAsPhone(cell.v) : String(cell.v);
  }

  const formatted = String(cell.w ?? cell.v ?? '').trim();
  if (isPhoneColumn && formatted) {
    return normalizePhone(formatted).phone || formatted;
  }

  return formatted;
}

function parseExcelBuffer(buffer: ArrayBuffer): string[][] {
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: false });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const ref = sheet['!ref'];
  if (!ref) return [];

  const range = XLSX.utils.decode_range(ref);
  const rowCount = range.e.r - range.s.r + 1;
  const colCount = range.e.c - range.s.c + 1;
  const rows: string[][] = Array.from({ length: rowCount }, () => Array(colCount).fill(''));

  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const rowIdx = r - range.s.r;
      const colIdx = c - range.s.c;
      const cellRef = XLSX.utils.encode_cell({ r, c });
      rows[rowIdx][colIdx] = cellToImportString(sheet[cellRef], false);
    }
  }

  const headers = rows[0] ?? [];
  const phoneColumnIndexes = new Set(
    headers.map((header, index) => (isPhoneHeader(header) ? index : -1)).filter(index => index >= 0)
  );
  if (phoneColumnIndexes.size === 0 && headers.length > 1) {
    phoneColumnIndexes.add(1);
  }

  for (let rowIdx = 1; rowIdx < rows.length; rowIdx++) {
    for (const colIdx of phoneColumnIndexes) {
      const cellRef = XLSX.utils.encode_cell({ r: range.s.r + rowIdx, c: range.s.c + colIdx });
      rows[rowIdx][colIdx] = cellToImportString(sheet[cellRef], true);
    }
  }

  return rows.filter((row, index) => index === 0 || row.some(cell => cell !== ''));
}

export async function readImportFile(file: File): Promise<{ rows: string[][]; csvText: string }> {
  const lower = file.name.toLowerCase();

  if (lower.endsWith('.csv')) {
    const text = await file.text();
    return { rows: parseCsvText(text), csvText: text };
  }

  if (lower.endsWith('.xlsx') || lower.endsWith('.xls')) {
    const buffer = await file.arrayBuffer();
    const rows = parseExcelBuffer(buffer);
    const csvText = rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
    return { rows, csvText };
  }

  throw new Error('Unsupported file type. Upload a .csv, .xlsx, or .xls file.');
}

export function rowsToImportPreview(rows: string[][]): {
  headers: string[];
  dataRows: string[][];
  columnMapping: Record<string, string>;
} {
  if (rows.length < 2) {
    throw new Error('File must include a header row and at least one data row.');
  }

  const headers = rows[0];
  const dataRows = rows.slice(1).filter(row => row.some(cell => cell !== ''));

  if (dataRows.length === 0) {
    throw new Error('No customer records found after the header row.');
  }

  const normalizedHeaders = headers.map(h => h.toLowerCase().replace(/[\s_-]+/g, ''));
  const findColumn = (...candidates: string[]) => {
    const idx = normalizedHeaders.findIndex(h => candidates.some(c => h.includes(c)));
    return idx >= 0 ? idx.toString() : undefined;
  };

  const columnMapping: Record<string, string> = {
    name: findColumn('name', 'customer', 'company') ?? '0',
    phone: findColumn('phone', 'mobile', 'whatsapp', 'tel') ?? '1',
    email: findColumn('email', 'mail') ?? '2',
    tags: findColumn('tag', 'segment', 'label', 'category') ?? '3',
  };

  return { headers, dataRows, columnMapping };
}

function cleanCell(value: string | undefined): string {
  return (value ?? '').replace(/"/g, '').trim();
}

export function validateImportRows(
  dataRows: string[][],
  columnMapping: Record<string, string>
): ImportRowValidation[] {
  const nameCol = parseInt(columnMapping.name, 10);
  const phoneCol = parseInt(columnMapping.phone, 10);
  const emailCol = parseInt(columnMapping.email, 10);
  const tagsCol = parseInt(columnMapping.tags, 10);

  return dataRows.map((row, rowIndex) => {
    const name = cleanCell(row[nameCol]);
    const rawPhone = cleanCell(row[phoneCol]);
    const email = cleanCell(row[emailCol]);
    const tags = cleanCell(row[tagsCol]);
    const errors: string[] = [];

    if (!name) errors.push('Name is required');

    const phoneResult = normalizePhone(rawPhone);
    if (phoneResult.error) errors.push(phoneResult.error);
    if (email && !isValidEmail(email)) errors.push('Email format is invalid');

    return {
      rowIndex: rowIndex + 2,
      name: name || '—',
      phone: phoneResult.phone || rawPhone || '—',
      email: email || '—',
      tags: tags || '—',
      errors,
    };
  });
}

export function buildCustomerFromImportRow(
  row: string[],
  columnMapping: Record<string, string>,
  index: number,
  assignedSalesUserId: string
) {
  const nameCol = parseInt(columnMapping.name, 10);
  const phoneCol = parseInt(columnMapping.phone, 10);
  const emailCol = parseInt(columnMapping.email, 10);
  const tagsCol = parseInt(columnMapping.tags, 10);

  const name = cleanCell(row[nameCol]) || 'Unknown Name';
  const phoneResult = normalizePhone(cleanCell(row[phoneCol]));
  if (phoneResult.error) {
    throw new Error(`Row ${index + 2}: ${phoneResult.error}`);
  }

  const email = cleanCell(row[emailCol]);
  if (email && !isValidEmail(email)) {
    throw new Error(`Row ${index + 2}: Email format is invalid`);
  }

  const parsedTags = cleanCell(row[tagsCol])
    ? cleanCell(row[tagsCol]).split(';').map(tag => tag.trim()).filter(Boolean)
    : ['Imported'];

  return {
    id: `c-import-${Date.now()}-${index}`,
    name,
    phone: phoneResult.phone,
    email,
    tags: parsedTags,
    assignedSalesUserId,
    created_at: new Date().toISOString(),
    optInStatus: true,
    notes: 'Bulk uploaded via customer import utility.',
  };
}
