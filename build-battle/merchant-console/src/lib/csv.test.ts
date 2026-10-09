import { describe, expect, it } from "vitest"
import { Payment } from "@/data/types"
import {
  DEFAULT_EXPORT_COLUMNS,
  EXPORT_COLUMNS,
  ExportColumn,
  exportFilename,
  exportLabel,
  parseColumns,
  parseScope,
  toCsv,
} from "./csv"

/**
 * The export is the file ops hands to a merchant, so a broken cell is a
 * support ticket rather than a stack trace. These tests pin the escaping and
 * the column contract; NWP-101 changes which columns ship, not how a cell is
 * written, and these should still pass afterwards.
 */

const payment: Payment = {
  id: "pay_0001",
  merchantId: "mch_01",
  amount: 25000,
  currency: "USD",
  status: "captured",
  method: "card",
  cardBrand: "visa",
  last4: "4242",
  createdAt: "2026-03-14T10:15:00.000Z",
  description: "Order 1180",
}

describe("toCsv", () => {
  it("writes a header row followed by one row per payment", () => {
    const lines = toCsv([payment]).split("\n")
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe(EXPORT_COLUMNS.join(","))
  })

  it("writes only the requested columns, in the order given", () => {
    expect(toCsv([payment], ["id", "amount"])).toBe(
      ["id,amount", "pay_0001,$250.00"].join("\n"),
    )
  })

  it("quotes cells containing a comma, so amounts do not split", () => {
    const large = { ...payment, amount: 123456789 }
    expect(toCsv([large], ["amount"])).toBe(['amount', '"$1,234,567.89"'].join("\n"))
  })

  it("doubles embedded quotes rather than dropping them", () => {
    const quoted = { ...payment, description: 'Order "rush"' }
    expect(toCsv([quoted], ["description"])).toBe(
      ["description", '"Order ""rush"""'].join("\n"),
    )
  })

  it("keeps a newline inside a description in one quoted cell", () => {
    const multiline = { ...payment, description: "Order 1180\nsecond line" }
    const body = toCsv([multiline], ["description"]).split("\n").slice(1).join("\n")
    expect(body).toBe('"Order 1180\nsecond line"')
  })

  it("resolves the merchant name, and falls back to the id when unknown", () => {
    expect(toCsv([payment], ["merchant"])).toContain("Lumen Coffee Roasters")
    const orphan = { ...payment, merchantId: "mch_missing" }
    expect(toCsv([orphan], ["merchant"])).toContain("mch_missing")
  })

  it("writes an empty cell for a payment with no card", () => {
    const bank: Payment = {
      ...payment,
      method: "bank_transfer",
      cardBrand: null,
      last4: null,
    }
    expect(toCsv([bank], ["card_brand", "last4"])).toBe(
      ["card_brand,last4", ","].join("\n"),
    )
  })

  it("emits a header even with no rows", () => {
    expect(toCsv([], ["id"])).toBe("id")
  })
})

/** Unwraps a successful parse so a failure shows the reason in the test output. */
function columnsFrom(raw: string | null): ExportColumn[] {
  const parsed = parseColumns(raw)
  if (!parsed.ok) throw new Error(parsed.error)
  return parsed.value
}

describe("column selection (NWP-101)", () => {
  it("writes a chosen subset in the order requested, not the allowlist order", () => {
    const columns = columnsFrom("amount,id,status")
    expect(columns).toEqual(["amount", "id", "status"])
    expect(toCsv([payment], columns)).toBe(
      ["amount,id,status", "$250.00,pay_0001,captured"].join("\n"),
    )
  })

  it("collapses a repeated column and ignores stray spaces", () => {
    expect(columnsFrom(" id , currency,id ")).toEqual(["id", "currency"])
  })

  it("leaves the card last four out when no columns are requested", () => {
    const columns = columnsFrom(null)
    expect(columns).toEqual([...DEFAULT_EXPORT_COLUMNS])
    expect(columns).not.toContain("last4")

    const [header, row] = toCsv([payment], columns).split("\n")
    expect(header.split(",")).not.toContain("last4")
    expect(row).not.toContain("4242")
  })

  it("keeps every other column in the default set, currency included", () => {
    expect(DEFAULT_EXPORT_COLUMNS).toEqual(
      EXPORT_COLUMNS.filter((column) => column !== "last4"),
    )
    expect(DEFAULT_EXPORT_COLUMNS).toContain("currency")
  })

  it("includes the last four only when asked for by name", () => {
    expect(toCsv([payment], columnsFrom("id,last4"))).toBe(
      ["id,last4", "pay_0001,4242"].join("\n"),
    )
  })

  it("rejects an empty selection instead of producing an empty file", () => {
    expect(parseColumns("")).toEqual({
      ok: false,
      error: "Choose at least one column",
    })
    expect(parseColumns(" , ,")).toEqual({
      ok: false,
      error: "Choose at least one column",
    })
    expect(() => toCsv([payment], [])).toThrow(RangeError)
  })

  it("rejects a column that is not on the allowlist rather than dropping it", () => {
    expect(parseColumns("id,pan")).toEqual({
      ok: false,
      error: "Unknown column: pan",
    })
  })
})

describe("parseScope", () => {
  it("defaults to the current filter and accepts only known scopes", () => {
    expect(parseScope(null)).toEqual({ ok: true, value: "filtered" })
    expect(parseScope("all")).toEqual({ ok: true, value: "all" })
    expect(parseScope("everything")).toEqual({
      ok: false,
      error: "Unknown scope: everything",
    })
  })
})

describe("exportFilename", () => {
  it("stamps the UTC date, so two exports on the same day collide by design", () => {
    expect(exportFilename(new Date("2026-03-14T23:00:00.000Z"))).toBe(
      "payments-2026-03-14.csv",
    )
  })

  it("names the scope: the status filter, all payments, or a plain filter", () => {
    const day = new Date("2026-08-13T12:00:00.000Z")
    expect(exportFilename(day, exportLabel("filtered", "disputed"))).toBe(
      "payments-disputed-2026-08-13.csv",
    )
    expect(exportFilename(day, exportLabel("all", "disputed"))).toBe(
      "payments-all-2026-08-13.csv",
    )
    expect(exportFilename(day, exportLabel("filtered", "all"))).toBe(
      "payments-filtered-2026-08-13.csv",
    )
  })
})
