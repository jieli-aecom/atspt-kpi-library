import assert from 'node:assert/strict';
import test from 'node:test';
import { installPopupDragGuard } from '../src/popupDragGuard.ts';

function fixture() {
  const document = new EventTarget();
  let inside = true;
  let underlyingClicks = 0;
  const cleanup = installPopupDragGuard(document as unknown as Document, () => inside);
  document.addEventListener('click', () => underlyingClicks++);
  const dispatch = (type: string, properties = {}, withinPicker = true) => {
    inside = withinPicker;
    const event = new Event(type, { cancelable: true });
    Object.assign(event, { pointerId: 1, button: 0, clientX: 10, clientY: 10, detail: 1 }, properties);
    document.dispatchEvent(event);
    return event;
  };
  return { dispatch, cleanup, clicks: () => underlyingClicks };
}

test('consumes a text-selection drag click targeted outside the portal', () => {
  const f = fixture();
  assert.equal(f.dispatch('pointerdown').defaultPrevented, false);
  f.dispatch('pointermove', { clientX: 100 }, false);
  assert.equal(f.dispatch('pointerup', { clientX: 100 }, false).defaultPrevented, false);
  assert.equal(f.dispatch('click', {}, false).defaultPrevented, true);
  assert.equal(f.clicks(), 0);
  // The next deliberate outside click is available to the normal dismissal handler.
  f.dispatch('pointerdown', {}, false);
  f.dispatch('pointerup', {}, false);
  assert.equal(f.dispatch('click', {}, false).defaultPrevented, false);
  assert.equal(f.clicks(), 1);
  f.cleanup();
});

test('tracks a drag that returns to its origin without consulting document selection', () => {
  const f = fixture();
  f.dispatch('pointerdown');
  f.dispatch('pointermove', { clientX: 100 });
  f.dispatch('pointerup');
  assert.equal(f.dispatch('click').defaultPrevented, true);
  assert.equal(f.clicks(), 0);
  f.cleanup();
});

test('normal clicks and keyboard activation remain usable after a drag with no click', () => {
  const f = fixture();
  f.dispatch('pointerdown');
  f.dispatch('pointerup', { clientX: 100 });
  assert.equal(f.dispatch('click', { detail: 0, pointerId: -1 }).defaultPrevented, false);
  f.dispatch('pointerdown');
  f.dispatch('pointerup', { clientX: 11 });
  assert.equal(f.dispatch('click').defaultPrevented, false);
  assert.equal(f.clicks(), 2);
  f.cleanup();
});

test('release outside is guarded even without a movement event', () => {
  const f = fixture();
  f.dispatch('pointerdown');
  f.dispatch('pointerup', {}, false);
  assert.equal(f.dispatch('click', {}, false).defaultPrevented, true);
  f.cleanup();
});

test('cancel and cleanup discard drag suppression', () => {
  const f = fixture();
  f.dispatch('pointerdown');
  f.dispatch('pointermove', { clientX: 100 });
  f.dispatch('pointercancel');
  assert.equal(f.dispatch('click').defaultPrevented, false);
  f.dispatch('pointerdown');
  f.dispatch('pointermove', { clientX: 100 });
  f.cleanup();
  assert.equal(f.dispatch('click').defaultPrevented, false);
});
