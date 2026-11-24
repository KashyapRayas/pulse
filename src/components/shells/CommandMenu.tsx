"use client"

import * as React from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Dialog as DialogPrimitive } from "radix-ui"
import {
  Activity,
  BarChart3,
  CalendarDays,
  Dumbbell,
  FileText,
  Gauge,
  HeartPulse,
  Keyboard,
  LayoutGrid,
  Moon,
  MoonStar,
  NotebookPen,
  Search,
  Settings,
  Sparkles,
  Stethoscope,
  Sun,
  SunMoon,
  Waves,
  Zap,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useTheme } from "@/hooks/use-theme"
import { openSheet } from "./SheetTrigger"
import { useOptionalShellCalendar, useOptionalShellStatus } from "./ShellStatus"

// Linear's keyboard layer (linear.app): ⌘K opens a command menu that searches every destination and action, "G then a
// letter" jumps between views, "C" starts the main action (here the check-in) and "?" lists every shortcut. Single-key
// shortcuts never fire while you type in a field or while another dialog is open.

/** Routes that read `?d=`: jumping between them keeps the day on screen, as the date pill does. */
const DAY_ROUTES = new Set(["/", "/recovery", "/strain", "/sleep", "/health/healthspan", "/health/monitor", "/health/stress", "/journal"])

type Go = { kind: "go"; href: string }
type Run = { kind: "run"; run: () => void }
export type Command = {
  id: string
  label: string
  group: "Navigate" | "Actions" | "Appearance"
  icon: LucideIcon
  /** Keys shown on the right, e.g. ["G", "R"]; also what the "G" sequence listens for. */
  keys?: string[]
  /** Extra words the search matches ("hrv" finds Recovery). */
  keywords?: string
} & (Go | Run)

export const NAV_COMMANDS: (Omit<Command, "kind"> & Go)[] = [
  { id: "home", label: "Home", group: "Navigate", icon: LayoutGrid, href: "/", keys: ["G", "H"], kind: "go", keywords: "today dashboard" },
  { id: "recovery", label: "Recovery", group: "Navigate", icon: Gauge, href: "/recovery", keys: ["G", "R"], kind: "go", keywords: "hrv resting heart rate readiness" },
  { id: "sleep", label: "Sleep", group: "Navigate", icon: Moon, href: "/sleep", keys: ["G", "S"], kind: "go", keywords: "sleep performance debt need" },
  { id: "strain", label: "Strain", group: "Navigate", icon: Zap, href: "/strain", keys: ["G", "T"], kind: "go", keywords: "load zones activity" },
  { id: "health", label: "Health", group: "Navigate", icon: HeartPulse, href: "/health", keys: ["G", "E"], kind: "go" },
  { id: "pulse-age", label: "Pulse Age", group: "Navigate", icon: Sparkles, href: "/health/healthspan", keys: ["G", "A"], kind: "go", keywords: "healthspan pace of aging" },
  { id: "monitor", label: "Health Monitor", group: "Navigate", icon: Stethoscope, href: "/health/monitor", keys: ["G", "M"], kind: "go", keywords: "vitals spo2 skin temperature illness" },
  { id: "stress", label: "Stress Monitor", group: "Navigate", icon: Waves, href: "/health/stress", keys: ["G", "X"], kind: "go" },
  { id: "fitness", label: "Fitness", group: "Navigate", icon: Dumbbell, href: "/health/fitness", keys: ["G", "F"], kind: "go", keywords: "vo2 max training load acwr" },
  { id: "journal", label: "Journal", group: "Navigate", icon: NotebookPen, href: "/journal", keys: ["G", "J"], kind: "go", keywords: "behaviours check-in" },
  { id: "insights", label: "Behaviour insights", group: "Navigate", icon: Activity, href: "/journal/insights", kind: "go", keywords: "journal impact" },
  { id: "trends", label: "Trends", group: "Navigate", icon: BarChart3, href: "/trends", keys: ["G", "D"], kind: "go" },
  { id: "reports", label: "Reports", group: "Navigate", icon: FileText, href: "/reports", keys: ["G", "P"], kind: "go", keywords: "weekly monthly" },
  { id: "activities", label: "Activities", group: "Navigate", icon: CalendarDays, href: "/activities", kind: "go", keywords: "workouts" },
  { id: "settings", label: "Settings", group: "Navigate", icon: Settings, href: "/settings", keys: ["G", ","], kind: "go", keywords: "profile sync account" },
]

/** Keys of the "G then …" sequence, lower-cased, to the destination. */
export const GO_KEYS: Record<string, string> = Object.fromEntries(
  NAV_COMMANDS.filter((c) => c.keys?.[0] === "G").map((c) => [c.keys![1].toLowerCase(), c.href]),
)

/** Opens the menu from anywhere (the sidebar's Search row). */
export const COMMAND_MENU_EVENT = "pulse:command-menu"
export const openCommandMenu = (mode: "commands" | "shortcuts" = "commands") =>
  window.dispatchEvent(new CustomEvent(COMMAND_MENU_EVENT, { detail: mode }))

const isEditable = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))
const otherDialogOpen = () => !!document.querySelector('[role="dialog"][data-state="open"]:not([data-command-menu])')

/** Case-insensitive match on every word of the query against the label and keywords. */
export function matches(c: Pick<Command, "label" | "keywords">, query: string) {
  const hay = `${c.label} ${c.keywords ?? ""}`.toLowerCase()
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((w) => hay.includes(w))
}

const noSubscribe = () => () => {}
/** The modifier label for ⌘K on this device: ⌘ on Apple platforms, Ctrl elsewhere (⌘ on the server). */
function useModKey() {
  return React.useSyncExternalStore(noSubscribe, () => (/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl"), () => "⌘")
}

export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-grid h-5 min-w-5 place-items-center rounded-sm border border-border bg-muted px-1 font-sans text-[11px] leading-none font-medium text-muted-foreground",
        className
      )}
    >
      {children}
    </kbd>
  )
}

export function CommandMenu() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const status = useOptionalShellStatus()
  const calendar = useOptionalShellCalendar()
  const { setTheme } = useTheme()
  const mod = useModKey()
  const [open, setOpen] = React.useState(false)
  const [mode, setMode] = React.useState<"commands" | "shortcuts">("commands")
  const [query, setQuery] = React.useState("")
  const [active, setActive] = React.useState(0)
  const listId = React.useId()

  const day = params.get("d")
  const hrefFor = React.useCallback(
    (href: string) => (day && DAY_ROUTES.has(href) && DAY_ROUTES.has(pathname) && day !== calendar?.today ? `${href}?d=${day}` : href),
    [day, pathname, calendar?.today],
  )
  const go = React.useCallback((href: string) => router.push(hrefFor(href)), [router, hrefFor])

  const commands: Command[] = React.useMemo(
    () => [
      ...NAV_COMMANDS,
      ...(status?.coach ? [{ id: "coach", label: "Coach", group: "Navigate" as const, icon: Sparkles, href: "/coach", kind: "go" as const, keywords: "ai assistant chat" }] : []),
      { id: "checkin", label: "Check in", group: "Actions", icon: NotebookPen, keys: ["C"], kind: "run", run: () => openSheet("checkin"), keywords: "journal log" },
      { id: "today", label: "Go to today", group: "Actions", icon: CalendarDays, kind: "run", run: () => router.push(pathname), keywords: "date day" },
      { id: "shortcuts", label: "Keyboard shortcuts", group: "Actions", icon: Keyboard, keys: ["?"], kind: "run", run: () => openCommandMenu("shortcuts"), keywords: "keys help" },
      { id: "theme-dark", label: "Switch to dark theme", group: "Appearance", icon: MoonStar, kind: "run", run: () => setTheme("dark"), keywords: "appearance" },
      { id: "theme-light", label: "Switch to light theme", group: "Appearance", icon: Sun, kind: "run", run: () => setTheme("light"), keywords: "appearance" },
      { id: "theme-system", label: "Use system theme", group: "Appearance", icon: SunMoon, kind: "run", run: () => setTheme("system"), keywords: "appearance auto" },
    ],
    [status?.coach, router, pathname, setTheme],
  )
  const shown = React.useMemo(() => commands.filter((c) => matches(c, query)), [commands, query])

  const show = React.useCallback((next: "commands" | "shortcuts") => {
    setMode(next)
    setQuery("")
    setActive(0)
    setOpen(true)
  }, [])

  const run = React.useCallback(
    (c: Command) => {
      setOpen(false)
      if (c.kind === "go") go(c.href)
      else c.run()
    },
    [go],
  )

  // ⌘K, "G then …", "C" and "?" from anywhere in the app.
  React.useEffect(() => {
    let pendingG = 0
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault()
        if (open && mode === "commands") setOpen(false)
        else show("commands")
        return
      }
      if (open || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || isEditable(e.target) || otherDialogOpen()) return
      const key = e.key.toLowerCase()
      if (pendingG && Date.now() - pendingG < 1200) {
        pendingG = 0
        const href = GO_KEYS[key]
        if (href) {
          e.preventDefault()
          go(href)
        }
        return
      }
      if (key === "g") pendingG = Date.now()
      else if (key === "c" && !e.shiftKey) {
        e.preventDefault()
        openSheet("checkin")
      } else if (e.key === "?") {
        e.preventDefault()
        show("shortcuts")
      }
    }
    const onOpen = (e: Event) => show((e as CustomEvent<"commands" | "shortcuts">).detail ?? "commands")
    window.addEventListener("keydown", onKey)
    window.addEventListener(COMMAND_MENU_EVENT, onOpen)
    return () => {
      window.removeEventListener("keydown", onKey)
      window.removeEventListener(COMMAND_MENU_EVENT, onOpen)
    }
  }, [open, mode, show, go])

  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      const n = shown.length
      if (n) setActive((a) => (a + (e.key === "ArrowDown" ? 1 : n - 1)) % n)
    } else if (e.key === "Enter" && shown[active]) {
      e.preventDefault()
      run(shown[active])
    }
  }

  const groups = ["Navigate", "Actions", "Appearance"] as const
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-dim/70 duration-150 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0" />
        <DialogPrimitive.Content
          data-command-menu
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => mode === "shortcuts" && e.preventDefault()}
          className="fixed top-[max(12vh,calc(var(--inset-top)+16px))] left-1/2 z-50 w-[min(640px,calc(100%-24px))] -translate-x-1/2 overflow-hidden rounded-3xl bg-popover text-popover-foreground shadow-overlay duration-150 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.98] data-closed:animate-out data-closed:fade-out-0"
        >
          {mode === "commands" ? (
            <>
              <DialogPrimitive.Title className="sr-only">Command menu</DialogPrimitive.Title>
              <div className="flex items-center gap-2.5 border-b border-border px-4">
                <Search aria-hidden className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <input
                  autoFocus
                  role="combobox"
                  aria-expanded="true"
                  aria-controls={listId}
                  aria-activedescendant={shown[active] ? `${listId}-${shown[active].id}` : undefined}
                  aria-label="Type a command or search"
                  placeholder="Type a command or search…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value)
                    setActive(0)
                  }}
                  onKeyDown={onListKey}
                  className="h-12 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-muted-foreground"
                />
                <Kbd>Esc</Kbd>
              </div>
              <ul id={listId} role="listbox" aria-label="Commands" className="max-h-[min(420px,60svh)] overflow-y-auto p-2">
                {shown.length === 0 && <li className="px-2 py-6 text-center text-[13px] text-muted-foreground">No results</li>}
                {groups.map((g) => {
                  const items = shown.filter((c) => c.group === g)
                  if (!items.length) return null
                  return (
                    <li key={g} role="presentation">
                      <p aria-hidden className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                        {g}
                      </p>
                      <ul role="group" aria-label={g}>
                        {items.map((c) => {
                          const i = shown.indexOf(c)
                          const Icon = c.icon
                          return (
                            <li
                              key={c.id}
                              id={`${listId}-${c.id}`}
                              role="option"
                              aria-selected={i === active}
                              onMouseMove={() => setActive(i)}
                              onClick={() => run(c)}
                              className="flex h-9 cursor-pointer items-center gap-3 rounded-lg px-2 text-[13px] font-medium text-foreground-secondary aria-selected:bg-foreground/[0.06] aria-selected:text-foreground"
                            >
                              <Icon aria-hidden className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                              <span className="min-w-0 flex-1">{c.label}</span>
                              {c.keys && (
                                <span aria-hidden className="flex gap-1">
                                  {c.keys.map((k) => (
                                    <Kbd key={k}>{k}</Kbd>
                                  ))}
                                </span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </li>
                  )
                })}
              </ul>
            </>
          ) : (
            <div className="p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <DialogPrimitive.Title className="text-[15px] font-semibold">Keyboard shortcuts</DialogPrimitive.Title>
                <Kbd>Esc</Kbd>
              </div>
              <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {[
                  { label: "Command menu", keys: [mod, "K"] },
                  { label: "Check in", keys: ["C"] },
                  { label: "Keyboard shortcuts", keys: ["?"] },
                  ...NAV_COMMANDS.filter((c) => c.keys).map((c) => ({ label: `Go to ${c.label}`, keys: c.keys! })),
                ].map((s) => (
                  <div key={s.label} className="flex h-8 items-center justify-between gap-3 border-b border-border/60 text-[13px]">
                    <dt className="text-foreground-secondary">{s.label}</dt>
                    <dd className="flex gap-1">
                      {s.keys.map((k) => (
                        <Kbd key={k}>{k}</Kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

/** The sidebar's search row (Linear's "Search" at the top of the sidebar). */
export function CommandMenuButton({ compact = false }: { compact?: boolean }) {
  const mod = useModKey()
  if (compact)
    return (
      <button
        type="button"
        aria-label="Search and commands"
        onClick={() => openCommandMenu()}
        className="mb-2 grid size-10 place-items-center rounded-lg text-muted-foreground transition-[background-color,color] duration-150 ease-standard outline-none hover:bg-foreground/[0.06] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Search aria-hidden className="size-[18px]" strokeWidth={1.75} />
      </button>
    )
  return (
    <button
      type="button"
      onClick={() => openCommandMenu()}
      className="mb-2 flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-[13px] leading-5 font-medium text-foreground-secondary transition-[background-color,color] duration-150 ease-standard outline-none hover:bg-foreground/[0.04] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Search aria-hidden className="size-4 shrink-0" strokeWidth={1.75} />
      <span className="flex-1 text-left">Search</span>
      <span aria-hidden className="flex gap-1">
        <Kbd>{mod}</Kbd>
        <Kbd>K</Kbd>
      </span>
    </button>
  )
}
