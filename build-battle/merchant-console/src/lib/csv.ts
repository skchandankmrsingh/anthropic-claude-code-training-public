import { merchantById } from "@/data/merchants"
import { Payment } from "@/data/types"
import { formatMoney } from "./money"

/**
 * CSV export for the payments table.
 *
 * Ops chooses the columns and the scope (NWP-101). Both arrive from the
 * client, so they are checked against the allowlists below before anything
 * is written. The card last four is never in a file unless someone asked.
 */

/** Every column the export can write, in the order the dialog lists them. */
export const EXPORT_COLUMNS = [
  "id",
  "created_at",
  "merchant",
  "description",
  "status",
  "method",
  "card_brand",
  "last4",
  "amount",
  "currency",
] as const

export type ExportColumn = (typeof EXPORT_COLUMNS)[number]

/** What a file gets when nobody chose: everything except the card last four. */
export const DEFAULT_EXPORT_COLUMNS: readonly ExportColumn[] = EXPORT_COLUMNS.filter(
  (column) => column !== "last4",
)

export const EXPORT_SCOPES = ["filtered", "all"] as const

export type ExportScope = (typeof EXPORT_SCOPES)[number]

type Parsed<T> = { ok: true; value: T } | { ok: false; error: string }

/**
 * Validate a comma-separated column list from the client. Absent means the
 * defaults; unknown names are rejected rather than dropped, and an empty
 * selection is an error so no one downloads a file with nothing in it.
 */
export function parseColumns(raw: string | null): Parsed<ExportColumn[]> {
  if (raw === null) return { ok: true, value: [...DEFAULT_EXPORT_COLUMNS] }

  const requested = raw
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)

  const columns: ExportColumn[] = []
  for (const name of requested) {
    if (!EXPORT_COLUMNS.includes(name as ExportColumn)) {
      return { ok: false, error: `Unknown column: ${name}` }
    }
    if (!columns.includes(name as ExportColumn)) columns.push(name as ExportColumn)
  }

  if (columns.length === 0) {
    return { ok: false, error: "Choose at least one column" }
  }
  return { ok: true, value: columns }
}

/** Validate the export scope. Absent means the current filter. */
export function parseScope(raw: string | null): Parsed<ExportScope> {
  if (raw === null) return { ok: true, value: "filtered" }
  if (EXPORT_SCOPES.includes(raw as ExportScope)) {
    return { ok: true, value: raw as ExportScope }
  }
  return { ok: false, error: `Unknown scope: ${raw}` }
}

function escapeCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`
  return value
}

function cell(payment: Payment, column: ExportColumn): string {
  switch (column) {
    case "id":
      return payment.id
    case "created_at":
      return payment.createdAt
    case "merchant":
      return merchantById(payment.merchantId)?.name ?? payment.merchantId
    case "description":
      return payment.description
    case "status":
      return payment.status
    case "method":
      return payment.method
    case "card_brand":
      return payment.cardBrand ?? ""
    case "last4":
      return payment.last4 ?? ""
    case "amount":
      return formatMoney(payment.amount, payment.currency)
    case "currency":
      return payment.currency
  }
}

export function toCsv(
  payments: Payment[],
  columns: readonly ExportColumn[] = EXPORT_COLUMNS,
): string {
  if (columns.length === 0) {
    throw new RangeError("An export needs at least one column")
  }
  const header = columns.join(",")
  const rows = payments.map((payment) =>
    columns.map((column) => escapeCell(cell(payment, column))).join(","),
  )
  return [header, ...rows].join("\n")
}

/**
 * The filename label for a scope: `all`, the active status, or `filtered`.
 * Status must already have been through parseFilters' allowlist.
 */
export function exportLabel(scope: ExportScope, status?: string): string {
  if (scope === "all") return "all"
  return status && status !== "all" ? status : "filtered"
}

/**
 * `payments-disputed-2026-08-13.csv`. The label must come from an allowlist
 * (a scope or a status), never from free text like a search term.
 */
export function exportFilename(date = new Date(), label?: string): string {
  const day = date.toISOString().slice(0, 10)
  return label ? `payments-${label}-${day}.csv` : `payments-${day}.csv`
}
