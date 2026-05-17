/**
 * Browser-API shapes that aren't in lib.dom yet but ship in evergreen
 * Chromium / WebKit / Firefox. Feature-detect at the call site —
 * these types describe the contract when the API is present.
 */

/** A WakeLockSentinel — what `wakeLock.request('screen')` resolves to. */
export type WakeLockSentinel = {
  release(): Promise<void>;
  addEventListener(type: "release", cb: () => void): void;
};

/** `navigator.wakeLock`, when implemented. */
export type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request(type: "screen"): Promise<WakeLockSentinel>;
  };
};
