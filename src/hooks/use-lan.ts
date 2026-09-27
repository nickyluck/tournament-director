"use client";

import { useEffect, useState } from "react";
import type { LanInfo } from "@/lib/lan";

export function useLanInfo() {
  const [info, setInfo] = useState<LanInfo | null>(null);

  useEffect(() => {
    void fetch("/api/lan")
      .then((r) => r.json())
      .then((data: LanInfo) => setInfo(data))
      .catch(() => setInfo(null));
  }, []);

  return info;
}
