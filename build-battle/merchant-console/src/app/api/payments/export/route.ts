import { filterPayments, parseFilters, sortPayments } from "@/data/queries"
import {
  exportFilename,
  exportLabel,
  parseColumns,
  parseScope,
  toCsv,
} from "@/lib/csv"
import { NextRequest, NextResponse } from "next/server"

/**
 * Exports the payments table as CSV.
 *
 * `scope` is `filtered` (the default: the filters on the page) or `all`.
 * `columns` is a comma-separated list checked against the export allowlist;
 * without it the file gets the defaults, which leave out the card last four.
 * Both go through the one query builder, unpaginated, so the file holds every
 * matching row rather than the page on screen.
 */
export function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams

  const scope = parseScope(params.get("scope"))
  if (!scope.ok) return NextResponse.json({ error: scope.error }, { status: 400 })

  const columns = parseColumns(params.get("columns"))
  if (!columns.ok) {
    return NextResponse.json({ error: columns.error }, { status: 400 })
  }

  const filters = parseFilters(
    scope.value === "all" ? new URLSearchParams() : params,
  )
  const rows = sortPayments(
    filterPayments(filters),
    filters.sort,
    filters.direction,
  )

  // Status is allowlisted by parseFilters, so it is safe in a filename.
  const filename = exportFilename(new Date(), exportLabel(scope.value, filters.status))

  return new Response(toCsv(rows, columns.value), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
    },
  })
}
