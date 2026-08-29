import { useEffect } from 'react';
import { useMap } from 'react-leaflet';
import { useAppOverlayOpen } from '../lib/app-overlay-context';

/** Close Leaflet tooltips/popups when the user interacts with app chrome (nav, menu, tabs). */
export function MapInteractionDismiss({
  onClearSelection
}: {
  onClearSelection?: () => void;
}) {
  const map = useMap();
  const appOverlayOpen = useAppOverlayOpen();

  useEffect(() => {
    const closeTooltips = () => {
      map.eachLayer((layer) => {
        if ('closeTooltip' in layer && typeof layer.closeTooltip === 'function') {
          layer.closeTooltip();
        }
      });
      map.closePopup();
    };

    const dismiss = () => {
      closeTooltips();
      onClearSelection?.();
    };

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('.app-map')) return;
      if (
        target.closest('[data-app-chrome]') ||
        target.closest('nav') ||
        target.closest('[role="dialog"]')
      ) {
        dismiss();
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };

    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [map, onClearSelection]);

  useEffect(() => {
    if (!appOverlayOpen) return;
    map.eachLayer((layer) => {
      if ('closeTooltip' in layer && typeof layer.closeTooltip === 'function') {
        layer.closeTooltip();
      }
    });
    map.closePopup();
    onClearSelection?.();
  }, [appOverlayOpen, map, onClearSelection]);

  return null;
}
