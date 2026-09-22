import assert from 'node:assert/strict';
import test from 'node:test';
import { installVerticalScrollChaining } from '../src/scrollChaining.ts';

function fixture(childMax = 100) {
  const document = { defaultView: { getComputedStyle: (node: ScrollElement) => ({
    overflowY: node.overflowY, lineHeight: '20px', fontSize: '12px'
  }) }, scrollingElement: null as ScrollElement | null };
  class ScrollElement extends EventTarget {
    ownerDocument = document;
    clientHeight = 200;
    scrollTop = 0;
    overflowY = 'auto';
    scrollHeight: number;
    parentElement: ScrollElement | null;
    constructor(scrollHeight: number, parentElement: ScrollElement | null = null) {
      super();
      this.scrollHeight = scrollHeight;
      this.parentElement = parentElement;
    }
    scrollBy({ top }: { top: number }) {
      this.scrollTop = Math.max(0, Math.min(this.scrollHeight - this.clientHeight, this.scrollTop + top));
    }
  }
  const page = new ScrollElement(2000);
  document.scrollingElement = page;
  const parent = new ScrollElement(1200, page);
  parent.scrollTop = 300;
  const wrapper = new ScrollElement(500, parent);
  wrapper.overflowY = 'hidden';
  const child = new ScrollElement(200 + childMax, wrapper);
  const cleanup = installVerticalScrollChaining(child as unknown as HTMLElement);
  const wheel = (deltaY: number, properties: Record<string, unknown> = {}) => {
    const { cancelable = true, ...wheelProperties } = properties;
    const event = new Event('wheel', { cancelable: Boolean(cancelable) });
    Object.assign(event, { deltaX: 0, deltaY, deltaMode: 0, ctrlKey: false, shiftKey: false }, wheelProperties);
    child.dispatchEvent(event);
    return event;
  };
  return { child, wrapper, parent, page, wheel, cleanup };
}

test('a cell without overflow immediately scrolls its parent in both directions', () => {
  const f = fixture(0);
  assert.equal(f.wheel(60).defaultPrevented, true);
  assert.equal(f.parent.scrollTop, 360);
  f.wheel(-40);
  assert.equal(f.parent.scrollTop, 320);
  assert.equal(f.child.scrollTop, 0);
  assert.equal(f.wrapper.scrollTop, 0);
});

test('continues the same gesture into the parent and reverses into the child', () => {
  const f = fixture();
  f.wheel(70);
  assert.equal(f.child.scrollTop, 70);
  assert.equal(f.parent.scrollTop, 300);
  f.wheel(60);
  assert.equal(f.child.scrollTop, 100);
  assert.equal(f.parent.scrollTop, 330);
  f.wheel(20);
  assert.equal(f.parent.scrollTop, 350);
  f.wheel(-75);
  assert.equal(f.child.scrollTop, 25);
  assert.equal(f.parent.scrollTop, 350);
  f.wheel(-60);
  assert.equal(f.child.scrollTop, 0);
  assert.equal(f.parent.scrollTop, 315);
  f.wheel(-20);
  assert.equal(f.parent.scrollTop, 295);
});

test('passes excess movement past an exhausted parent to the page', () => {
  const f = fixture();
  f.child.scrollTop = 90;
  f.parent.scrollTop = 990;
  f.wheel(50);
  assert.equal(f.child.scrollTop, 100);
  assert.equal(f.parent.scrollTop, 1000);
  assert.equal(f.page.scrollTop, 30);
});

test('normalizes line and page wheel units', () => {
  const f = fixture();
  f.wheel(3, { deltaMode: 1 });
  assert.equal(f.child.scrollTop, 60);
  f.wheel(1, { deltaMode: 2 });
  assert.equal(f.child.scrollTop, 100);
  assert.equal(f.parent.scrollTop, 460);
});

test('fractional browser rounding does not move the parent in the opposite direction', () => {
  const f = fixture();
  f.child.scrollBy = ({ top }) => { f.child.scrollTop += Math.round(top); };
  f.wheel(0.6);
  assert.equal(f.child.scrollTop, 1);
  assert.equal(f.parent.scrollTop, 300);
  f.wheel(-0.6);
  assert.equal(f.child.scrollTop, 0);
  assert.equal(f.parent.scrollTop, 300);
});

test('leaves horizontal, modified, and noncancelable events native and removes its listener', () => {
  const f = fixture();
  for (const properties of [{ deltaX: 80 }, { ctrlKey: true }, { shiftKey: true }, { cancelable: false }]) {
    assert.equal(f.wheel(40, properties).defaultPrevented, false);
  }
  assert.equal(f.child.scrollTop, 0);
  assert.equal(f.parent.scrollTop, 300);
  f.cleanup();
  assert.equal(f.wheel(40).defaultPrevented, false);
  assert.equal(f.child.scrollTop, 0);
});
