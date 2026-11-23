import { act, fireEvent, render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

const push = vi.fn()
vi.mock("next/navigation", async () => ({
  useRouter: () => ({ push, refresh: vi.fn(), replace: vi.fn() }),
  usePathname: () => window.location.pathname,
  useSearchParams: (await import("./testing")).useLocationSearchParams,
}))

const { CommandMenu, GO_KEYS, NAV_COMMANDS, matches } = await import("./CommandMenu")

const key = (k: string, init: KeyboardEventInit = {}) => act(() => void fireEvent.keyDown(window, { key: k, ...init }))

describe("CommandMenu", () => {
  beforeEach(() => {
    push.mockClear()
    window.history.replaceState(null, "", "/")
  })

  it("every G shortcut is unique and lands on a listed destination", () => {
    const keys = NAV_COMMANDS.filter((c) => c.keys?.[0] === "G").map((c) => c.keys![1])
    expect(new Set(keys).size).toBe(keys.length)
    expect(GO_KEYS.r).toBe("/recovery")
    expect(GO_KEYS.a).toBe("/health/healthspan")
  })

  it("search matches every word against labels and keywords", () => {
    expect(matches({ label: "Recovery", keywords: "hrv resting heart rate" }, "hrv")).toBe(true)
    expect(matches({ label: "Recovery", keywords: "hrv resting heart rate" }, "heart rec")).toBe(true)
    expect(matches({ label: "Sleep" }, "hrv")).toBe(false)
  })

  it("G then R goes to Recovery; a lone R does nothing", () => {
    render(<CommandMenu />)
    key("r")
    expect(push).not.toHaveBeenCalled()
    key("g")
    key("r")
    expect(push).toHaveBeenCalledWith("/recovery")
  })

  it("keeps the day on screen between day views", () => {
    window.history.replaceState(null, "", "/recovery?d=2026-11-20")
    render(<CommandMenu />)
    key("g")
    key("s")
    expect(push).toHaveBeenCalledWith("/sleep?d=2026-11-20")
  })

  it("ignores single-key shortcuts while typing in a field", () => {
    render(
      <>
        <input aria-label="field" />
        <CommandMenu />
      </>,
    )
    const field = screen.getByLabelText("field")
    act(() => void fireEvent.keyDown(field, { key: "g" }))
    act(() => void fireEvent.keyDown(field, { key: "r" }))
    expect(push).not.toHaveBeenCalled()
  })

  it("⌘K opens the menu; typing filters it and Enter runs the first match", () => {
    render(<CommandMenu />)
    key("k", { metaKey: true })
    const input = screen.getByRole("combobox", { name: "Type a command or search" })
    act(() => void fireEvent.change(input, { target: { value: "pulse age" } }))
    expect(screen.getAllByRole("option").map((o) => o.textContent)).toEqual([expect.stringContaining("Pulse Age")])
    act(() => void fireEvent.keyDown(input, { key: "Enter" }))
    expect(push).toHaveBeenCalledWith("/health/healthspan")
  })

  it("C opens the check-in sheet over the current screen", () => {
    render(<CommandMenu />)
    key("c")
    expect(new URL(window.location.href).searchParams.get("checkin")).toBe("1")
  })

  it("? lists the shortcuts", () => {
    render(<CommandMenu />)
    key("?", { shiftKey: true })
    expect(screen.getByRole("heading", { name: "Keyboard shortcuts" })).toBeTruthy()
    expect(screen.getByText("Go to Recovery")).toBeTruthy()
  })
})
