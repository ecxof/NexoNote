/**
 * Global "single open" behavior for three-dots item menus.
 * When any menu opens, all others are closed. Used by ItemMenu components app-wide.
 */
import { createContext, useCallback, useRef } from 'react';

const noop = () => {};

export const ItemMenuContext = createContext({
  register: noop,
  unregister: noop,
  closeAllExcept: noop,
});

let menuIdCounter = 0;

export function ItemMenuProvider({ children }) {
  const callbacksRef = useRef(new Map());

  const register = useCallback((id, closeCallback) => {
    callbacksRef.current.set(id, closeCallback);
  }, []);

  const unregister = useCallback((id) => {
    callbacksRef.current.delete(id);
  }, []);

  const closeAllExcept = useCallback((exceptId) => {
    callbacksRef.current.forEach((close, id) => {
      if (id !== exceptId) close();
    });
  }, []);

  return (
    <ItemMenuContext.Provider value={{ register, unregister, closeAllExcept }}>
      {children}
    </ItemMenuContext.Provider>
  );
}

export function useItemMenuId() {
  const idRef = useRef(null);
  if (idRef.current === null) idRef.current = `item-menu-${++menuIdCounter}`;
  return idRef.current;
}
