"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "apos.selectedProjectId";

export type MinimalProject = {
  id: string;
  name: string;
  projectNumber: string;
};

type UseSelectedProjectResult = {
  selectedId: string;
  selectedProject: MinimalProject | null;
  setSelectedId: (id: string) => void;
  projects: MinimalProject[];
  loading: boolean;
  reload: () => Promise<void>;
};

/**
 * Globaler Projekt-Kontext mit localStorage-Persistenz.
 *
 * - Lädt die Projekt-Liste über /api/projekte
 * - Merkt sich die zuletzt gewählte Projekt-ID in localStorage unter `apos.selectedProjectId`
 * - Synchronisiert die Auswahl zwischen Tabs und zwischen Modul-Seiten im selben Tab
 *   (manuelles Dispatchen eines storage-Events nach lokaler Änderung)
 */
export function useSelectedProject(): UseSelectedProjectResult {
  const [projects, setProjects] = useState<MinimalProject[]>([]);
  const [selectedId, setSelectedIdState] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/projekte");
      if (res.ok) {
        const data: MinimalProject[] = await res.json();
        setProjects(data);
        const saved =
          typeof window !== "undefined"
            ? window.localStorage.getItem(STORAGE_KEY) ?? ""
            : "";
        if (saved && data.find((p) => p.id === saved)) {
          setSelectedIdState(saved);
        } else if (data.length > 0) {
          setSelectedIdState(data[0].id);
          if (typeof window !== "undefined") {
            window.localStorage.setItem(STORAGE_KEY, data[0].id);
          }
        } else {
          setSelectedIdState("");
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  // Cross-Tab- und Cross-Page-Sync: reagiere auf Änderungen des STORAGE_KEY.
  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === STORAGE_KEY) {
        setSelectedIdState(e.newValue ?? "");
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setSelectedId = useCallback((id: string) => {
    setSelectedIdState(id);
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem(STORAGE_KEY, id);
      else window.localStorage.removeItem(STORAGE_KEY);
      // Eigene Tabs: storage-Event feuert nicht für eigene Änderungen, also manuell dispatchen,
      // damit andere Komponenten auf derselben Seite/im selben Tab reagieren können.
      window.dispatchEvent(
        new StorageEvent("storage", { key: STORAGE_KEY, newValue: id })
      );
    }
  }, []);

  const selectedProject = projects.find((p) => p.id === selectedId) ?? null;

  return {
    selectedId,
    selectedProject,
    setSelectedId,
    projects,
    loading,
    reload,
  };
}
