import { useEffect, useRef, useCallback } from 'react';
import type { Role } from './rbac';
import { canAccess, firstPageFor } from './rbac';

export type FieldOverlayId = 'sidebar' | 'visit-log' | 'agent' | 'company';

export function isFieldMobileRole(role: Role) {
  return role === 'adr' || role === 'team_lead';
}

function pageHash(page: string) {
  return `#/${page}`;
}

export type OverlayState = {
  sidebar: boolean;
  visitLog: boolean;
  agent: boolean;
  company: boolean;
};

const OVERLAY_ORDER: FieldOverlayId[] = ['sidebar', 'visit-log', 'agent', 'company'];

function topOpenOverlay(o: OverlayState): FieldOverlayId | null {
  if (o.sidebar) return 'sidebar';
  if (o.visitLog) return 'visit-log';
  if (o.agent) return 'agent';
  if (o.company) return 'company';
  return null;
}

function overlayOpened(prev: OverlayState, next: OverlayState): FieldOverlayId | null {
  for (const id of OVERLAY_ORDER) {
    const key =
      id === 'sidebar'
        ? 'sidebar'
        : id === 'visit-log'
          ? 'visitLog'
          : id === 'agent'
            ? 'agent'
            : 'company';
    if (!prev[key as keyof OverlayState] && next[key as keyof OverlayState]) {
      return id;
    }
  }
  return null;
}

/**
 * Mobile / PWA back-button: close overlays first, then page stack, then trap on home.
 */
export function useFieldMobileNav({
  enabled,
  role,
  page,
  setPage,
  overlays,
  onCloseOverlay
}: {
  enabled: boolean;
  role: Role;
  page: string;
  setPage: (page: string) => void;
  overlays: OverlayState;
  onCloseOverlay: (id: FieldOverlayId) => void;
}) {
  const homePage = firstPageFor(role);
  const pageRef = useRef(page);
  const overlaysRef = useRef(overlays);
  const suppressPushRef = useRef(false);
  const stackRef = useRef<string[]>([homePage]);
  const prevOverlaysRef = useRef(overlays);

  pageRef.current = page;
  overlaysRef.current = overlays;

  const pushNavState = useCallback((targetPage: string) => {
    window.history.pushState(
      { fieldPro: true, page: targetPage },
      '',
      pageHash(targetPage)
    );
  }, []);

  useEffect(() => {
    if (!enabled) return;

    const fromHash = window.location.hash.replace(/^#\/?/, '').split('?')[0];
    if (fromHash && canAccess(role, fromHash)) {
      stackRef.current = [homePage, fromHash];
      suppressPushRef.current = true;
      setPage(fromHash);
    }

    if (!window.history.state?.fieldPro) {
      window.history.replaceState(
        { fieldPro: true, page: pageRef.current },
        '',
        pageHash(pageRef.current)
      );
      window.history.pushState(
        { fieldPro: true, page: pageRef.current },
        '',
        pageHash(pageRef.current)
      );
    }
  }, [enabled, role, homePage, setPage]);

  useEffect(() => {
    if (!enabled) return;
    if (suppressPushRef.current) {
      suppressPushRef.current = false;
      return;
    }

    const stack = stackRef.current;
    const last = stack[stack.length - 1];
    if (page !== last) {
      stack.push(page);
      pushNavState(page);
    }
  }, [enabled, page, pushNavState]);

  useEffect(() => {
    if (!enabled) return;
    const opened = overlayOpened(prevOverlaysRef.current, overlays);
    prevOverlaysRef.current = overlays;
    if (opened) {
      pushNavState(pageRef.current);
    }
  }, [enabled, overlays, pushNavState]);

  useEffect(() => {
    if (!enabled) return;

    const onPopState = () => {
      const open = topOpenOverlay(overlaysRef.current);
      if (open) {
        onCloseOverlay(open);
        suppressPushRef.current = true;
        pushNavState(pageRef.current);
        return;
      }

      const stack = stackRef.current;
      if (stack.length > 1) {
        stack.pop();
        const prev = stack[stack.length - 1];
        suppressPushRef.current = true;
        setPage(prev);
        window.history.replaceState(
          { fieldPro: true, page: prev },
          '',
          pageHash(prev)
        );
        return;
      }

      suppressPushRef.current = true;
      pushNavState(homePage);
    };

    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [enabled, homePage, setPage, pushNavState, onCloseOverlay]);
}
