import React, { useRef, useState } from 'react';
import { TileLayer } from 'react-leaflet';
import { getMapTileLayers } from '../lib/map-tiles';

const LAYERS = getMapTileLayers();

export function MapTileLayer() {
  const [layerIndex, setLayerIndex] = useState(0);
  const advancing = useRef(false);
  const layer = LAYERS[Math.min(layerIndex, LAYERS.length - 1)];

  return (
    <TileLayer
      key={layer.url}
      attribution={layer.attribution}
      url={layer.url}
      eventHandlers={{
        tileerror: () => {
          if (advancing.current || layerIndex + 1 >= LAYERS.length) return;
          advancing.current = true;
          setLayerIndex((i) => i + 1);
        }
      }}
    />
  );
}
