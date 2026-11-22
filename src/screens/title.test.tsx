import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { newProfile } from '../game/storage';
import Title from './Title';

const noop = () => {};
const render = (music: boolean) => {
  const profile = newProfile();
  profile.settings.music = music;
  return renderToStaticMarkup(
    createElement(Title, {
      profile, canContinue: false, onNewRun: noop, onContinue: noop, onLibrary: noop, onQuiz: noop, onStudy: noop,
      onToggleSfx: noop, onToggleMusic: noop, onToggleAutoSpeak: noop, onToggleKeyboard: noop,
    }),
  );
};

describe('Title music toggle', () => {
  it('shows the music state next to the sound toggle', () => {
    expect(render(true)).toContain('Music on');
    expect(render(false)).toContain('Music off');
  });
});
