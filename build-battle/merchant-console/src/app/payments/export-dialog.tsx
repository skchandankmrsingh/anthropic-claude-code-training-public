"use client"

import { Button } from "@/components/Button"
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/Drawer"
import { Download } from "lucide-react"
import { useState } from "react"

type Scope = "filtered" | "all"

const COLUMN_LABELS: Record<string, string> = {
  id: "Payment ID",
  created_at: "Created (UTC)",
  merchant: "Merchant",
  description: "Description",
  status: "Status",
  method: "Method",
  card_brand: "Card brand",
  last4: "Card last four",
  amount: "Amount",
  currency: "Currency",
}

/**
 * Export options for the payments table. Column names and scope go to the
 * export route as query params and are validated there; nothing here is the
 * enforcement. Counts and filenames are computed on the server and passed in.
 */
export function ExportDialog({
  query,
  columns,
  defaultColumns,
  counts,
  filenames,
}: {
  /** The current filter, as the page's query string. */
  query: string
  columns: readonly string[]
  defaultColumns: readonly string[]
  counts: Record<Scope, number>
  filenames: Record<Scope, string>
}) {
  const [scope, setScope] = useState<Scope>("filtered")
  const [selected, setSelected] = useState<string[]>([...defaultColumns])

  const toggle = (column: string) =>
    setSelected((current) =>
      current.includes(column)
        ? current.filter((c) => c !== column)
        : [...current, column],
    )

  // Keep the dialog's order rather than the order of clicks.
  const ordered = columns.filter((column) => selected.includes(column))

  const href = (() => {
    const params = new URLSearchParams(scope === "filtered" ? query : "")
    params.delete("page")
    params.set("scope", scope)
    params.set("columns", ordered.join(","))
    return `/api/payments/export?${params.toString()}`
  })()

  const blocked =
    ordered.length === 0
      ? "Choose at least one column."
      : counts[scope] === 0
        ? "No payments match this scope."
        : null

  return (
    <Drawer
      onOpenChange={(open) => {
        if (!open) return
        setScope("filtered")
        setSelected([...defaultColumns])
      }}
    >
      <DrawerTrigger asChild>
        <Button variant="secondary" className="w-full gap-2 py-1.5 sm:w-fit">
          <Download
            className="-ml-0.5 size-4 shrink-0 text-gray-400 dark:text-gray-600"
            aria-hidden="true"
          />
          Export
        </Button>
      </DrawerTrigger>
      <DrawerContent className="sm:max-w-md">
        <DrawerHeader>
          <DrawerTitle>Export payments</DrawerTitle>
          <DrawerDescription>
            Choose what goes in the CSV before you download it.
          </DrawerDescription>
        </DrawerHeader>

        <DrawerBody className="space-y-6">
          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Scope
            </legend>
            <div className="mt-2 space-y-2">
              {(["filtered", "all"] as const).map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="radio"
                    name="export-scope"
                    value={option}
                    checked={scope === option}
                    onChange={() => setScope(option)}
                    className="size-4 accent-blue-500"
                  />
                  <span>
                    {option === "filtered" ? "Current filter" : "All payments"}
                    <span className="text-gray-500">
                      {" "}
                      · {counts[option].toLocaleString()}{" "}
                      {counts[option] === 1 ? "payment" : "payments"}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-sm font-medium text-gray-900 dark:text-gray-50">
              Columns
            </legend>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {columns.map((column) => (
                <label
                  key={column}
                  className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300"
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(column)}
                    onChange={() => toggle(column)}
                    className="size-4 rounded accent-blue-500"
                  />
                  <span>
                    {COLUMN_LABELS[column] ?? column}
                    {column === "last4" && (
                      <span className="text-gray-500"> · sensitive</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <p className="text-sm text-gray-500">
            File:{" "}
            <span className="font-mono text-gray-900 dark:text-gray-50">
              {filenames[scope]}
            </span>
          </p>
          {blocked && (
            <p role="status" className="text-sm text-red-600 dark:text-red-500">
              {blocked}
            </p>
          )}
        </DrawerBody>

        <DrawerFooter className="gap-2">
          <DrawerClose asChild>
            <Button variant="secondary">Cancel</Button>
          </DrawerClose>
          {blocked ? (
            <Button disabled>Download</Button>
          ) : (
            <Button asChild>
              <a href={href} download={filenames[scope]}>
                Download
              </a>
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
