import { useEffect } from 'react';
import type { RunState } from '../game/run';
import { musicLevel, musicScene, onUserGesture, setMusicEnabled, setMusicLayers, setMusicScene } from './music';
import { layersFor, sceneFor } from './scenes';

/**
 * Keeps the music matched to the app: starts it on the first user gesture (browsers refuse audio before
 * one), then follows the music setting, the current screen's scene and the fight's layers.
 */
export function useMusic(view: string, run: RunState | null, enabled: boolean): void {
  useEffect(() => {
    const events = ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown'] as const;
    // keep listening until the browser has really let audio run (the first touch event may not count)
    const go = () => {
      if (onUserGesture()) events.forEach((e) => window.removeEventListener(e, go));
    };
    events.forEach((e) => window.addEventListener(e, go));
    // for the browser checks in the plan: read the music output level and scene from the page
    (window as unknown as { __music?: unknown }).__music = { level: musicLevel, scene: musicScene };
    return () => events.forEach((e) => window.removeEventListener(e, go));
  }, []);

  useEffect(() => setMusicEnabled(enabled), [enabled]);

  const scene = sceneFor(view, run);
  useEffect(() => setMusicScene(scene), [scene]);

  const { hook, enraged } = layersFor(run);
  useEffect(() => setMusicLayers({ hook, enraged }), [hook, enraged]);
}
