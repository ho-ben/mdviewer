export type StartupGate = {
  wait: () => Promise<void>;
  open: () => void;
};

export function createStartupGate(): StartupGate {
  let opened = false;
  let resolveReady: (() => void) | undefined;
  const ready = new Promise<void>((resolve) => {
    resolveReady = resolve;
  });

  return {
    wait: () => ready,
    open() {
      if (opened) return;
      opened = true;
      resolveReady?.();
    }
  };
}
