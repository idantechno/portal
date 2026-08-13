import type { KeyboardEvent } from "react";

/**
 * Touch devices (phones/tablets) have no comfortable Shift+Enter, and people
 * expect Enter to add a line break in a chat box — the on-screen "send" arrow
 * is how you send. Desktop keeps the fast Enter-to-send / Shift+Enter-newline
 * behaviour. `pointer: coarse` is the reliable "primary input is touch" signal.
 */
const IS_TOUCH =
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;

/**
 * Shared key handler for the agent chat composers. Call from a textarea's
 * onKeyDown; it sends on Enter (desktop only, without Shift) and otherwise lets
 * the keystroke fall through so Enter inserts a newline.
 */
export function handleComposerKeyDown(
  e: KeyboardEvent<HTMLTextAreaElement>,
  send: () => void,
) {
  if (IS_TOUCH) return; // on mobile Enter = newline; send via the button
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    send();
  }
}
