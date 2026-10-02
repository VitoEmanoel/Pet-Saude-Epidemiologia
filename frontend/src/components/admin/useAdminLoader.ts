"use client";

import { useCallback, useEffect, useState } from "react";
import { useAdminSession } from "./AdminSession";
import { errorMessage } from "./admin-ui";

export type LoaderState<T> =
  | { status: "loading" }
  | { status: "loaded"; data: T }
  | { status: "error"; message: string };

/** Carrega os dados de uma tela do admin; erro de sessão devolve o usuário ao login. */
export function useAdminLoader<T>(load: () => Promise<T>) {
  const { handleAuthError } = useAdminSession();
  const [state, setState] = useState<LoaderState<T>>({ status: "loading" });

  const reload = useCallback(async () => {
    try {
      const data = await load();
      setState({ status: "loaded", data });
    } catch (error) {
      if (!handleAuthError(error)) {
        setState({ status: "error", message: errorMessage(error, "Falha ao carregar os dados.") });
      }
    }
    // `load` é estável em cada tela (definido fora do componente).
  }, [handleAuthError]);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { state, reload };
}
