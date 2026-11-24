"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useSearchParams } from "next/navigation"
import { createLucideIcon, HeartPulse, Menu, NotebookPen, Settings, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Mark } from "@/components/brand/Mark"
import { Wordmark } from "@/components/brand/Wordmark"
import { dayLabel } from "@/lib/format"
import { haptic } from "@/lib/haptics"
import { parseDay, tabForPath, TAB_ROOT, type Tab } from "@/lib/url"
import { SheetTrigger } from "./SheetTrigger"
import { useTabNavigate } from "./AppNavigation"
import { useShellCalendar, useShellStatus } from "./ShellStatus"
import { CommandMenuButton } from "./CommandMenu"
import { DemoChip } from "./TopBar"

/** The reference app's Home glyph: a house outline framing a rising line chart (home-today-overview-top). Lucide's house, door swapped for a chart. */
const HomeChart = createLucideIcon("home-chart", [
  ["path", { d: "M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", key: "frame" }],
  ["path", { d: "m7 16 3-3 2.5 2.5L17 11", key: "chart" }],
])

const TABS: { tab: Tab; label: string; icon: LucideIcon }[] = [
  { tab: "home", label: "Home", icon: HomeChart },
  { tab: "health", label: "Health", icon: HeartPulse },
  { tab: "journal", label: "Journal", icon: NotebookPen },
  { tab: "more", label: "More", icon: Menu },
]
const ROOTS = new Set(Object.values(TAB_ROOT))

/**
 * Glass bar material (spec §2.6), for chrome that floats over scrolling content only: tab bar, rail,
 * sidebar, round action. A labelled web approximation of iOS Liquid Glass: near-opaque gradient fill,
 * 12 px blur, lit top edge, faint rim, soft lower shadow. Opaque under reduced transparency.
 */
export const GLASS = "bg-linear-to-b from-glass-top to-glass-bottom backdrop-blur-md backdrop-saturate-150 shadow-glass ring-1 ring-glass-rim"
const PRESS = "transition-[color,background-color,scale] duration-150 ease-standard outline-none active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-ring"
const ITEM_TONE = (active: boolean) => (active ? "text-foreground" : "text-muted-foreground hover:bg-foreground/[0.04] hover:text-foreground")
/** Sidebar rows read brighter at rest, as Linear's do: secondary text, full white when active. */
const ROW_TONE = (active: boolean) => (active ? "text-foreground" : "text-foreground-secondary hover:bg-foreground/[0.04] hover:text-foreground")

/**
 * The active item's highlight: one element that slides between items (150 ms), a flat tint as Linear marks the
 * current view.
 */
function Lens({ index, axis, className }: { index: number; axis: "x" | "y"; className: string }) {
  return (
    <span
      aria-hidden
      style={{ "--tab": index } as React.CSSProperties}
      className={cn(
        "pointer-events-none absolute bg-foreground/[0.07] transition-[translate,opacity] duration-150 ease-standard motion-reduce:transition-none",
        axis === "x" ? "translate-x-[calc(var(--tab)*100%)]" : "translate-y-[calc(var(--tab)*(100%+2px))]",
        index < 0 && "opacity-0",
        className
      )}
    />
  )
}

/** Phone tab bar: a 62 px floating panel with four destinations (spec §4.2, G1), on Linear's flat surface and hairline. */
function TabBar({ current }: { current: number }) {
  const go = useTabNavigate()
  return (
    <nav aria-label="Primary" onClick={() => haptic(6)} className={cn(GLASS, "relative h-[62px] min-w-0 flex-1 rounded-3xl p-1")}>
      <Lens index={current} axis="x" className="inset-y-1 left-1 w-[calc((100%-8px)/4)] rounded-2xl" />
      <ul className="relative grid h-full grid-cols-4">
        {TABS.map(({ tab, label, icon: Icon }, i) => (
          <li key={tab} className="min-w-0">
            <Link
              href={TAB_ROOT[tab]}
              onClick={(e) => go(TAB_ROOT[tab], e)}
              prefetch // full prefetch: the tabs open from the client cache, no skeleton flash
              aria-current={i === current ? "page" : undefined}
              className={cn(PRESS, ITEM_TONE(i === current), "flex h-full flex-col items-center justify-center gap-1 rounded-2xl hover:bg-transparent focus-visible:ring-inset")}
            >
              <Icon aria-hidden strokeWidth={1.75} className="size-[22px]" />
              <span className="text-[11px] leading-[13px] font-medium">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Tablet rail, 96 px, flush to the left edge on the navigation colour with a hairline, Linear's collapsed sidebar. */
function Rail({ current, wide, pathname }: { current: number; wide: boolean; pathname: string }) {
  const go = useTabNavigate()
  return (
    <nav aria-label="Primary" className={cn("fixed inset-y-0 left-0 z-30 hidden w-[96px] flex-col items-center border-r border-border bg-sidebar pt-[calc(var(--inset-top)+12px)] pb-3 md:flex", !wide && "xl:hidden")}>
      <Link
        href="/"
        aria-label="Pulse home"
        className="mb-4 grid size-10 place-items-center rounded-lg transition-[background-color,scale] duration-150 ease-standard outline-none hover:bg-foreground/[0.06] focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"
      >
        <span aria-hidden>
          <Mark className="size-6" />
        </span>
      </Link>
      <CommandMenuButton compact />
      <ul className="relative flex flex-col gap-0.5">
        <Lens index={current} axis="y" className="inset-x-0 top-0 h-14 rounded-lg" />
        {TABS.map(({ tab, label, icon: Icon }, i) => (
          <li key={tab} className="relative">
            <Link
              href={TAB_ROOT[tab]}
              onClick={(e) => go(TAB_ROOT[tab], e)}
              prefetch // full prefetch: the tabs open from the client cache, no skeleton flash
              aria-current={i === current ? "page" : undefined}
              className={cn(PRESS, ITEM_TONE(i === current), "flex h-14 w-[76px] flex-col items-center justify-center gap-1 rounded-lg")}
            >
              <Icon aria-hidden strokeWidth={1.75} className="size-5" />
              <span className="text-[11px] leading-4 font-medium">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
      {/* The full sidebar carries Settings; where the rail stands alone (the coach, Settings) it keeps its own. */}
      {wide && (
        <>
          <div aria-hidden className="my-2 h-px w-12 bg-border" />
          <Link
            href="/settings"
            onClick={(e) => go("/settings", e)}
            prefetch
            aria-current={pathname.startsWith("/settings") ? "page" : undefined}
            className={cn(PRESS, ITEM_TONE(pathname.startsWith("/settings")), "flex h-14 w-[76px] flex-col items-center justify-center gap-1 rounded-lg", pathname.startsWith("/settings") && "bg-foreground/[0.07]")}
          >
            <Settings aria-hidden strokeWidth={1.75} className="size-5" />
            <span className="text-[11px] leading-4 font-medium">Settings</span>
          </Link>
        </>
      )}
      <div className="mt-auto flex flex-col items-center gap-3">
        <React.Suspense>
          <CheckInAction variant="rail" />
        </React.Suspense>
      </div>
    </nav>
  )
}

/** Laptop sidebar, 244 px, flush to the left edge on the navigation colour (Linear's sidebar), Settings under a hairline. */
function Sidebar({ current, pathname }: { current: number; pathname: string }) {
  // Reports, Trends and the rest live in More (U21), so each destination is listed once.
  const extra = [{ href: "/settings", match: "/settings", label: "Settings", icon: Settings }]
  const extraActive = extra.some((e) => pathname.startsWith(e.match))
  const tab = extraActive ? -1 : current
  const go = useTabNavigate()
  const item = (href: string, label: string, Icon: LucideIcon, active: boolean, lit = false) => (
    <li key={label} className="relative">
      <Link
        href={href}
        onClick={(e) => go(href, e)}
        prefetch
        aria-current={active ? "page" : undefined}
        className={cn(PRESS, ROW_TONE(active), "flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] leading-5 font-medium", lit && "bg-foreground/[0.07]")}
      >
        <Icon aria-hidden strokeWidth={1.75} className="size-4 shrink-0" />
        {label}
      </Link>
    </li>
  )
  return (
    <nav aria-label="Primary" className="fixed inset-y-0 left-0 z-30 hidden w-[244px] flex-col border-r border-border bg-sidebar px-3 pt-[calc(var(--inset-top)+12px)] pb-3 xl:flex">
      <Link
        href="/"
        aria-label="Pulse home"
        className="mb-3 flex h-10 items-center rounded-md px-2 transition-[background-color] duration-150 ease-standard outline-none hover:bg-foreground/[0.04] focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span aria-hidden className="flex items-center gap-2">
          <Mark className="size-5" />
          <Wordmark className="h-[13px]" />
        </span>
      </Link>
      <CommandMenuButton />
      <ul className="relative flex flex-col gap-0.5">
        <Lens index={tab} axis="y" className="inset-x-0 top-0 h-8 rounded-md" />
        {TABS.map((t, i) => item(TAB_ROOT[t.tab], t.label, t.icon, i === tab))}
      </ul>
      <div aria-hidden className="mx-2 my-2 h-px bg-border" />
      <ul className="flex flex-col gap-0.5">{extra.map((e) => item(e.href, e.label, e.icon, pathname.startsWith(e.match), pathname.startsWith(e.match)))}</ul>
      <div className="mt-auto space-y-2">
        <React.Suspense>
          <CheckInAction variant="sidebar" />
        </React.Suspense>
        <div className="px-2">
          <DemoChip />
        </div>
      </div>
    </nav>
  )
}

const ACTION_FACE = "bg-linear-to-b from-glass-action-top to-glass-action-bottom ring-1 ring-border transition-[scale,filter,background-color] duration-150 ease-standard outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.98]"

/** The ringed monogram: "P" in a circle with the indigo-to-blue rim, the gradient Linear keeps for its AI. */
function Monogram({ small = false }: { small?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid shrink-0 place-items-center rounded-full border-[1.5px] border-transparent font-sans leading-none font-semibold [background:linear-gradient(var(--action-face),var(--action-face))_padding-box,linear-gradient(135deg,var(--action-rim-from),var(--action-rim-to))_border-box]",
        small ? "size-6 text-[11px]" : "size-[30px] text-[14px]"
      )}
    >
      P
    </span>
  )
}

/**
 * The "Check in" action (spec §4.2.1), the reference app's coach button: indigo-rimmed glass with the "P" monogram. Opens the
 * check-in for the day on screen over the screen itself through `?checkin=1` (spec §11 UX2). `float`: the round button over the content (phone).
 * `rail` and `sidebar`: the same action docked in the tablet rail and laptop sidebar, where floating over the content
 * column hid its right-hand controls (U18 G-02, D-L5).
 */
function CheckInAction({ variant }: { variant: "float" | "rail" | "sidebar" }) {
  const { today } = useShellCalendar()
  const { coach } = useShellStatus()
  const params = useSearchParams()
  const { d } = parseDay(params.get("d") ?? undefined, today)
  const label = `Check in for ${dayLabel(d, today)}`
  // With coach access the same button opens the coach (spec §11 V6), as the reference app's opens its assistant;
  // the check-in moves to the coach's first chip and the Journal tab.
  if (coach) {
    const face =
      variant === "sidebar"
        ? "flex h-9 items-center gap-2.5 rounded-md pr-3 pl-1.5 text-[13px] leading-5 font-medium"
        : cn("grid shrink-0 place-items-center", variant === "rail" ? "size-14 rounded-lg" : "size-[62px] rounded-3xl shadow-glass backdrop-blur-md backdrop-saturate-150")
    return (
      <Link href="/coach" aria-label="Open Coach" className={cn(ACTION_FACE, face)}>
        <Monogram small={variant === "sidebar"} />
        {variant === "sidebar" && "Coach"}
      </Link>
    )
  }
  if (variant === "sidebar")
    return (
      <SheetTrigger sheet="checkin" aria-label={label} className={cn(ACTION_FACE, "flex h-9 items-center gap-2.5 rounded-md pr-3 pl-1.5 text-[13px] leading-5 font-medium")}>
        <Monogram small />
        Check in
      </SheetTrigger>
    )
  return (
    <SheetTrigger
      sheet="checkin"
      aria-label={label}
      className={cn(
        ACTION_FACE,
        "grid shrink-0 place-items-center",
        variant === "rail" ? "size-14 rounded-lg" : "size-[62px] rounded-3xl shadow-glass backdrop-blur-md backdrop-saturate-150"
      )}
    >
      <Monogram />
    </SheetTrigger>
  )
}

/**
 * Navigation in three forms switched by CSS only (spec §4.2): the glass tab bar plus the round
 * action below 768 px (tab roots; detail screens show the action alone), the rail from 768 px and
 * the sidebar from 1280 px, each with the check-in action docked at its foot (D-L5).
 */
export function AppNav() {
  const pathname = usePathname()
  const index = TABS.findIndex((t) => t.tab === tabForPath(pathname))
  const root = ROOTS.has(pathname)
  // The coach and Settings keep the rail on laptop too: their own panel sits beside it, and two full sidebars read as one too many.
  const railOnly = pathname === "/coach" || pathname === "/settings"
  return (
    <>
      {/* No tab is current on the coach (tabForPath files it under Home); the Coach button is where you are. */}
      <Rail current={pathname.startsWith("/coach") || pathname.startsWith("/settings") ? -1 : index} wide={railOnly} pathname={pathname} />
      {!railOnly && <Sidebar current={index} pathname={pathname} />}
      <div className="pointer-events-none fixed inset-x-3 bottom-[max(calc(env(safe-area-inset-bottom)-6px),12px)] z-30 flex touch-manipulation justify-end gap-2 *:pointer-events-auto md:hidden" data-tabbar>
        {root && (
          <div className="flex min-w-0 flex-1">
            <TabBar current={index} />
          </div>
        )}
        {/* Not on Settings, nor on the coach, whose composer sits where the button would. */}
        {!pathname.startsWith("/settings") && !pathname.startsWith("/coach") && (
          <React.Suspense>
            <CheckInAction variant="float" />
          </React.Suspense>
        )}
      </div>
    </>
  )
}
