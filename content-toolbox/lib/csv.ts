/**
 * Minimal, dependency-free CSV utilities (RFC 4180-ish).
 * Handles quoted fields, embedded commas, quotes, and CR/LF newlines.
 */

export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ""
  let inQuotes = false
  let i = 0

  // Strip BOM
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)

  while (i < text.length) {
    const char = text[i]

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i += 2
        } else {
          inQuotes = false
          i++
        }
      } else {
        field += char
        i++
      }
      continue
    }

    if (char === '"') {
      inQuotes = true
      i++
    } else if (char === ",") {
      row.push(field)
      field = ""
      i++
    } else if (char === "\r") {
      // Treat \r\n or lone \r as newline
      row.push(field)
      field = ""
      rows.push(row)
      row = []
      i += text[i + 1] === "\n" ? 2 : 1
    } else if (char === "\n") {
      row.push(field)
      field = ""
      rows.push(row)
      row = []
      i++
    } else {
      field += char
      i++
    }
  }

  // Flush trailing field/row
  if (field.length > 0 || row.length > 0) {
    row.push(field)
    rows.push(row)
  }

  // Drop fully-empty trailing rows
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""))
}

type CsvCell = string | number | boolean | null | undefined

function escapeCell(value: CsvCell): string {
  if (value === null || value === undefined) return ""
  const str = String(value)
  if (/[",\r\n]/.test(str)) {
    return '"' + str.replace(/"/g, '""') + '"'
  }
  return str
}

export function toCsv(rows: CsvCell[][]): string {
  return rows.map((row) => row.map(escapeCell).join(",")).join("\r\n")
}

/** Normalize a header for tolerant matching: lowercase, strip non-alphanumerics. */
export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "")
}

/**
 * Build a lookup from normalized header name -> column index.
 * Later duplicate headers do not override earlier ones.
 */
export function headerIndex(headers: string[]): Map<string, number> {
  const map = new Map<string, number>()
  headers.forEach((h, i) => {
    const key = normalizeHeader(h)
    if (!map.has(key)) map.set(key, i)
  })
  return map
}

export function parseBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) return undefined
  const v = value.trim().toLowerCase()
  if (v === "") return undefined
  return v === "true" || v === "1" || v === "yes" || v === "y"
}
