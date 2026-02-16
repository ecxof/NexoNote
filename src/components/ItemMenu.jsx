/**
 * Three-dot menu for note or folder. Renders dropdown in a portal so it is never
 * clipped. Positions within viewport (flips left/right, top/bottom). Only one menu
 * open app-wide via ItemMenuContext.
 */
import { useState, useRef, useEffect, useLayoutEffect, useId, useContext } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, Pencil, Trash2, Copy, ClipboardPaste, FolderInput } from 'lucide-react';
import { ItemMenuContext } from '../context/ItemMenuContext';

const DROPDOWN_PADDING = 8;
const SUBMENU_OFFSET = 4;

function useDropdownPosition(open, triggerRef, dropdownRef) {
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useLayoutEffect(() => {
    if (!open || !triggerRef.current || !dropdownRef.current) return;
    const trigger = triggerRef.current.getBoundingClientRect();
    const dropdown = dropdownRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = trigger.left;
    let top = trigger.bottom + 2;

    if (left + dropdown.width + DROPDOWN_PADDING > vw) left = Math.max(DROPDOWN_PADDING, trigger.right - dropdown.width);
    if (left < DROPDOWN_PADDING) left = DROPDOWN_PADDING;
    if (top + dropdown.height + DROPDOWN_PADDING > vh) top = trigger.top - dropdown.height - 2;
    if (top < DROPDOWN_PADDING) top = DROPDOWN_PADDING;

    setPosition({ top, left });
  }, [open]);

  return position;
}

function useSubmenuPosition(open, moveOpen, dropdownRef, submenuRef) {
  const [subPosition, setSubPosition] = useState(null);

  useLayoutEffect(() => {
    if (!open || !moveOpen || !dropdownRef.current || !submenuRef.current) {
      setSubPosition(null);
      return;
    }
    const dropdown = dropdownRef.current.getBoundingClientRect();
    const sub = submenuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = dropdown.right + SUBMENU_OFFSET;
    let top = dropdown.top;
    if (left + sub.width + DROPDOWN_PADDING > vw) left = dropdown.left - sub.width - SUBMENU_OFFSET;
    if (left < DROPDOWN_PADDING) left = DROPDOWN_PADDING;
    if (top + sub.height + DROPDOWN_PADDING > vh) top = vh - sub.height - DROPDOWN_PADDING;
    if (top < DROPDOWN_PADDING) top = DROPDOWN_PADDING;
    setSubPosition({ top, left });
  }, [open, moveOpen]);

  return subPosition;
}

export function NoteItemMenu({
  noteId,
  noteTitle,
  onRename,
  onDelete,
  onCopy,
  onPaste,
  onMoveToFolder,
  canPaste,
  folders,
  className = '',
}) {
  const menuId = useId();
  const { register, unregister, closeAllExcept } = useContext(ItemMenuContext);
  const [open, setOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const submenuRef = useRef(null);

  const close = () => { setOpen(false); setMoveOpen(false); };

  useEffect(() => {
    if (!open) return;
    register(menuId, close);
    return () => unregister(menuId);
  }, [open, menuId, register, unregister]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (triggerRef.current?.contains(e.target) || dropdownRef.current?.contains(e.target) || submenuRef.current?.contains(e.target)) return;
      close();
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [open]);

  const toggleOpen = (e) => {
    e.stopPropagation();
    closeAllExcept(menuId);
    setOpen((o) => !o);
  };

  const position = useDropdownPosition(open, triggerRef, dropdownRef);
  const subPosition = useSubmenuPosition(open, moveOpen, dropdownRef, submenuRef);

  const dropdownEl = open && (
    <>
      <div
        ref={dropdownRef}
        className="item-menu-dropdown item-menu-dropdown-portal"
        style={{
          position: 'fixed',
          top: position.top,
          left: position.left,
          zIndex: 10050,
          margin: 0,
        }}
      >
        <button type="button" className="item-menu-item" onClick={() => { onRename?.(noteId, noteTitle); close(); }}>
          <Pencil size={14} /> Rename
        </button>
        <button type="button" className="item-menu-item" onClick={() => { onCopy?.(noteId); close(); }}>
          <Copy size={14} /> Copy
        </button>
        {canPaste && (
          <button type="button" className="item-menu-item" onClick={() => { onPaste?.(); close(); }}>
            <ClipboardPaste size={14} /> Paste
          </button>
        )}
        <div className="item-menu-sub">
          <button type="button" className="item-menu-item" onClick={() => setMoveOpen((m) => !m)}>
            <FolderInput size={14} /> Move to folder
          </button>
        </div>
        <button type="button" className="item-menu-item item-menu-item-danger" onClick={() => { onDelete?.(noteId); close(); }}>
          <Trash2 size={14} /> Delete
        </button>
      </div>
      {moveOpen && (
        <div
          ref={submenuRef}
          className="item-menu-submenu item-menu-dropdown-portal"
          style={{
            position: 'fixed',
            top: subPosition?.top ?? 0,
            left: subPosition?.left ?? 0,
            zIndex: 10051,
            margin: 0,
            visibility: subPosition ? 'visible' : 'hidden',
          }}
        >
          <button
            type="button"
            className="item-menu-item"
            onClick={() => { onMoveToFolder?.(noteId, null); close(); }}
          >
            All Notes
          </button>
          {(folders || []).map((f) => (
            <button
              key={f.id}
              type="button"
              className="item-menu-item"
              onClick={() => { onMoveToFolder?.(noteId, f.id); close(); }}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}
    </>
  );

  return (
    <>
      <div className={`item-menu-wrap ${className}`}>
        <button
          ref={triggerRef}
          type="button"
          className="item-menu-trigger"
          onClick={toggleOpen}
          aria-label="Actions"
          title="Actions"
          aria-expanded={open}
        >
          <MoreVertical size={16} />
        </button>
      </div>
      {typeof document !== 'undefined' && dropdownEl && createPortal(dropdownEl, document.body)}
    </>
  );
}

export function PdfItemMenu({
  pdfId,
  pdfTitle,
  onRename,
  onDelete,
  onCopy,
  onPaste,
  onMoveToFolder,
  canPaste,
  folders,
  className = '',
}) {
  const menuId = useId();
  const { register, unregister, closeAllExcept } = useContext(ItemMenuContext);
  const [open, setOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const submenuRef = useRef(null);

  const close = () => { setOpen(false); setMoveOpen(false); };

  useEffect(() => {
    if (!open) return;
    register(menuId, close);
    return () => unregister(menuId);
  }, [open, menuId, register, unregister]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (triggerRef.current?.contains(e.target) || dropdownRef.current?.contains(e.target) || submenuRef.current?.contains(e.target)) return;
      close();
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [open]);

  const toggleOpen = (e) => {
    e.stopPropagation();
    closeAllExcept(menuId);
    setOpen((o) => !o);
  };

  const position = useDropdownPosition(open, triggerRef, dropdownRef);
  const subPosition = useSubmenuPosition(open, moveOpen, dropdownRef, submenuRef);

  const dropdownEl = open && (
    <>
      <div
        ref={dropdownRef}
        className="item-menu-dropdown item-menu-dropdown-portal"
        style={{
          position: 'fixed',
          top: position.top,
          left: position.left,
          zIndex: 10050,
          margin: 0,
        }}
      >
        <button type="button" className="item-menu-item" onClick={() => { onRename?.(pdfId, pdfTitle); close(); }}>
          <Pencil size={14} /> Rename
        </button>
        <button type="button" className="item-menu-item" onClick={() => { onCopy?.(pdfId); close(); }}>
          <Copy size={14} /> Copy
        </button>
        {canPaste && (
          <button type="button" className="item-menu-item" onClick={() => { onPaste?.(); close(); }}>
            <ClipboardPaste size={14} /> Paste
          </button>
        )}
        <div className="item-menu-sub">
          <button type="button" className="item-menu-item" onClick={() => setMoveOpen((m) => !m)}>
            <FolderInput size={14} /> Move to folder
          </button>
        </div>
        <button type="button" className="item-menu-item item-menu-item-danger" onClick={() => { onDelete?.(pdfId); close(); }}>
          <Trash2 size={14} /> Delete
        </button>
      </div>
      {moveOpen && (
        <div
          ref={submenuRef}
          className="item-menu-submenu item-menu-dropdown-portal"
          style={{
            position: 'fixed',
            top: subPosition?.top ?? 0,
            left: subPosition?.left ?? 0,
            zIndex: 10051,
            margin: 0,
            visibility: subPosition ? 'visible' : 'hidden',
          }}
        >
          <button
            type="button"
            className="item-menu-item"
            onClick={() => { onMoveToFolder?.(pdfId, null); close(); }}
          >
            All Notes
          </button>
          {(folders || []).map((f) => (
            <button
              key={f.id}
              type="button"
              className="item-menu-item"
              onClick={() => { onMoveToFolder?.(pdfId, f.id); close(); }}
            >
              {f.name}
            </button>
          ))}
        </div>
      )}
    </>
  );

  return (
    <>
      <div className={`item-menu-wrap ${className}`}>
        <button
          ref={triggerRef}
          type="button"
          className="item-menu-trigger"
          onClick={toggleOpen}
          aria-label="PDF actions"
          title="Actions"
          aria-expanded={open}
        >
          <MoreVertical size={16} />
        </button>
      </div>
      {typeof document !== 'undefined' && dropdownEl && createPortal(dropdownEl, document.body)}
    </>
  );
}

export function FolderItemMenu({
  folderId,
  folderName,
  onRename,
  onDelete,
  className = '',
}) {
  const menuId = useId();
  const { register, unregister, closeAllExcept } = useContext(ItemMenuContext);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);

  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    register(menuId, close);
    return () => unregister(menuId);
  }, [open, menuId, register, unregister]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (triggerRef.current?.contains(e.target) || dropdownRef.current?.contains(e.target)) return;
      close();
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, [open]);

  const toggleOpen = (e) => {
    e.stopPropagation();
    closeAllExcept(menuId);
    setOpen((o) => !o);
  };

  const position = useDropdownPosition(open, triggerRef, dropdownRef);

  const dropdownEl = open && (
    <div
      ref={dropdownRef}
      className="item-menu-dropdown item-menu-dropdown-portal"
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        zIndex: 10050,
        margin: 0,
      }}
    >
      <button type="button" className="item-menu-item" onClick={() => { onRename?.(folderId, folderName); close(); }}>
        <Pencil size={14} /> Rename
      </button>
      <button type="button" className="item-menu-item item-menu-item-danger" onClick={() => { onDelete?.(folderId); close(); }}>
        <Trash2 size={14} /> Delete
      </button>
    </div>
  );

  return (
    <>
      <div className={`item-menu-wrap ${className}`}>
        <button
          ref={triggerRef}
          type="button"
          className="item-menu-trigger"
          onClick={toggleOpen}
          aria-label="Folder actions"
          title="Actions"
          aria-expanded={open}
        >
          <MoreVertical size={16} />
        </button>
      </div>
      {typeof document !== 'undefined' && dropdownEl && createPortal(dropdownEl, document.body)}
    </>
  );
}
