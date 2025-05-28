import { describe, it, expect } from 'vitest';

import { createInitialState, reducer, selectors, ViewState } from '../../src/stateMachine';

function apply(state: ViewState, evt: Parameters<typeof reducer>[1]) {
  const [next, eff] = reducer(state, evt);
  return { next, eff } as const;
}

describe('stateMachine.reducer', () => {
  it('toggles nav visibility', () => {
    const s0 = createInitialState({ navHidden: false });
    const { next, eff } = apply(s0, { type: 'ToggleNav' });
    expect(next.navHidden).toBe(true);
    expect(eff).toContainEqual({ type: 'Render' });
  });

  it('selects a feed and resets page / expansion', () => {
    const s0 = createInitialState({ currentFeed: null, currentPage: 2 });
    s0.expandedItems.add('abc');
    const { next, eff } = apply(s0, { type: 'SelectFeed', feed: 'news' });
    expect(next.currentFeed).toBe('news');
    expect(next.currentPage).toBe(0);
    expect(next.expandedItems.size).toBe(0);
    expect(eff).toEqual(
      expect.arrayContaining([{ type: 'ResetFeedSpecificState' }, { type: 'Render' }])
    );
  });

  it('cycles item order', () => {
    let st = createInitialState({ itemOrder: 'New to old' });
    st = apply(st, { type: 'CycleItemOrder' }).next;
    expect(st.itemOrder).toBe('Old to new');
    st = apply(st, { type: 'CycleItemOrder' }).next;
    expect(st.itemOrder).toBe('Random');
    st = apply(st, { type: 'CycleItemOrder' }).next;
    expect(st.itemOrder).toBe('New to old');
  });

  it('moves to next and previous page correctly', () => {
    let st = createInitialState({ currentPage: 0 });
    // hasMore = true → advance
    st = apply(st, { type: 'NextPage', hasMore: true }).next;
    expect(st.currentPage).toBe(1);
    // PrevPage should decrement
    st = apply(st, { type: 'PrevPage' }).next;
    expect(st.currentPage).toBe(0);
    // PrevPage at 0 keeps at 0
    st = apply(st, { type: 'PrevPage' }).next;
    expect(st.currentPage).toBe(0);
  });

  it('expands and collapses items', () => {
    const s0 = createInitialState();
    const { next: s1 } = apply(s0, { type: 'ExpandItem', id: 'x1' });
    expect(selectors.isItemExpanded(s1, 'x1')).toBe(true);

    const { next: s2 } = apply(s1, { type: 'CollapseItem', id: 'x1' });
    expect(selectors.isItemExpanded(s2, 'x1')).toBe(false);
  });
});
