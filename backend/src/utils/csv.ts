/**
 * Converts an array of objects into a formatted CSV string.
 * Automatically wraps values in double quotes and escapes existing double quotes.
 */
export const convertToCSV = (
  data: Array<Record<string, unknown>>,
  headers: Array<{ label: string; key: string }>
): string => {
const FORMULA_TRIGGER_CHARS = ['=', '+', '-', '@', '\t', '\r'];
const sanitizeCsvValue = (val: string): string => {
  if (FORMULA_TRIGGER_CHARS.includes(val.charAt(0))) {
    return `'${val}`;
  }
  return val;
};
  const headerLine = headers.map(h => `"${h.label.replace(/"/g, '""')}"`).join(',');
  const bodyLines = data.map(row => {
    return headers.map(h => {
      const val = row[h.key];
      const valStr = val === null || val === undefined ? '' : String(val);
      return `"${sanitizeCsvValue(valStr).replace(/"/g, '""')}"`;
    }).join(',');
  });
  return [headerLine, ...bodyLines].join('\n');
};
