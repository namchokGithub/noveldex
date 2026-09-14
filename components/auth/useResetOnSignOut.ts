"use client";

import { useState } from "react";

export function useResetOnSignOut(isAdmin: boolean, reset: () => void): void {
  const [wasAdmin, setWasAdmin] = useState(isAdmin);
  if (wasAdmin !== isAdmin) {
    setWasAdmin(isAdmin);
    if (!isAdmin) reset();
  }
}
