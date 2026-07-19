/**
 * Context for the global "single open" three-dots item menu behavior.
 * The provider component lives in ItemMenuProvider.jsx (kept separate so this
 * file only exports non-components, which keeps Fast Refresh working).
 */
import { createContext, useRef } from 'react';

const noop = () => {};

export const ItemMenuContext = createContext({
  register: noop,
  unregister: noop,
  closeAllExcept: noop,
});

let menuIdCounter = 0;

export function useItemMenuId() {
  const idRef = useRef(null);
  if (idRef.current === null) idRef.current = `item-menu-${++menuIdCounter}`;
  return idRef.current;
}
