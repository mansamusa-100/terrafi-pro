import { createContext, useContext } from 'react';

/** True when sidebar, drawer, or modal chrome is open over the main content. */
export const AppOverlayOpenContext = createContext(false);

export function useAppOverlayOpen() {
  return useContext(AppOverlayOpenContext);
}
