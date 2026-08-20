/**
 * Global "single open" behavior for three-dots item menus.
 * When any menu opens, all others are closed. Used by ItemMenu components app-wide.
 */
import { useCallback, useRef } from 'react';
import { ItemMenuContext } from './ItemMenuContext';

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
