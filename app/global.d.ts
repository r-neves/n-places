import type NodeCache from 'node-cache';

declare global {
  var placesCache: NodeCache;
}

export {};