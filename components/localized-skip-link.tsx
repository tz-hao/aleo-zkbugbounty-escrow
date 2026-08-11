"use client";

import { useLocale } from "./locale-provider";

export function LocalizedSkipLink() {
  const { copy } = useLocale();
  return <a className="skip-link" href="#main-content">{copy.common.skipToContent}</a>;
}
