import { useEffect } from "react";

/**
 * Sets the tab title for screens that are NOT rendered inside `Layout`
 * (the public pages: landing, login, sign-up, password reset). Without this
 * every route shared the one title from `index.html`, so the tab strip and
 * browser history could not tell two pages apart (F09).
 *
 * `Layout` sets the same format for every signed-in page.
 */
export function usePageTitle(title: string, suffix = true) {
  useEffect(() => {
    document.title = suffix ? `${title} · Docufy PSMS` : title;
  }, [title, suffix]);
}
