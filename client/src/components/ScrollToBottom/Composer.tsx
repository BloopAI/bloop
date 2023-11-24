import React, {
  PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react';
import useStateRef from '../../hooks/useStateRef';
import InternalContext from './InternalContext';
import SpineTo from './SpineTo';
import EventSpy from './EventSpy';
import FunctionContext from './FunctionContext';

const DEFAULT_SCROLLER = () => Infinity;
const MIN_CHECK_INTERVAL = 17; // 1 frame
const NEAR_END_THRESHOLD = 1;
const SCROLL_DECISION_DURATION = 34; // 2 frames

function setImmediateInterval(fn: () => void, ms: number) {
  fn();

  return setInterval(fn, ms);
}

function computeViewState({
  target: { offsetHeight, scrollHeight, scrollTop },
}: {
  target: {
    offsetHeight: number;
    scrollHeight: number;
    scrollTop: number;
  };
}) {
  const atBottom = scrollHeight - scrollTop - offsetHeight < NEAR_END_THRESHOLD;
  const atTop = scrollTop < NEAR_END_THRESHOLD;

  const atEnd = atBottom;
  const atStart = atBottom;

  return {
    atBottom,
    atEnd,
    atStart,
    atTop,
  };
}

const Composer = ({ children }: PropsWithChildren) => {
  const ignoreScrollEventBeforeRef = useRef(0);
  const initialScrollBehaviorRef = useRef<false | 'auto' | 'smooth'>('auto');
  const [animateTo, setAnimateTo, animateToRef] = useStateRef('100%');
  const [target, setTarget, targetRef] = useStateRef(null);

  // Internal context
  const animateFromRef = useRef(0);
  const offsetHeightRef = useRef(0);
  const scrollHeightRef = useRef(0);

  const [_, setSticky, stickyRef] = useStateRef(true);

  // High-rate state context
  const scrollPositionObserversRef = useRef<
    ((opts: { scrollTop: number }) => void)[]
  >([]);

  const handleSpineToEnd = useCallback(() => {
    const { current: animateTo } = animateToRef;

    ignoreScrollEventBeforeRef.current = Date.now();

    // handleScrollEnd may end at a position which should lose stickiness.
    // In that case, we will need to set sticky to false to stop the interval check.
    // Test case:
    // 1. Add a scroller that always return 0
    // 2. Show a panel with mode === MODE_BOTTOM
    // 3. Programmatically scroll to 0 (set element.scrollTop = 0)
    // Expected: it should not repetitively call scrollTo(0)
    //           it should set stickiness to false

    animateTo === '100%' || setSticky(false);
    setAnimateTo(null);
  }, [animateToRef, ignoreScrollEventBeforeRef, setAnimateTo, setSticky]);

  // Function context
  const scrollTo = useCallback(
    (
      nextAnimateTo: string | number,
      { behavior }: { behavior?: 'smooth' | 'auto' } = {},
    ) => {
      const { current: target } = targetRef;

      if (behavior === 'auto') {
        // Stop any existing animation
        handleSpineToEnd();

        if (target) {
          // Jump to the scroll position
          target.scrollTop =
            nextAnimateTo === '100%'
              ? target.scrollHeight - target.offsetHeight
              : nextAnimateTo;
        }
      } else {
        setAnimateTo(nextAnimateTo);
      }

      // This is for handling a case. When calling scrollTo('100%', { behavior: 'auto' }) multiple times, it would lose stickiness.
      if (nextAnimateTo === '100%') {
        setSticky(true);
      }
    },
    [handleSpineToEnd, setAnimateTo, setSticky, targetRef],
  );

  const scrollToBottom = useCallback(
    ({ behavior }: { behavior?: 'smooth' | 'auto' } = {}) => {
      scrollTo('100%', { behavior: behavior || 'smooth' });
    },
    [scrollTo],
  );

  const scrollToSticky = useCallback(() => {
    const { current: target } = targetRef;

    if (target) {
      if (initialScrollBehaviorRef.current === 'auto') {
        target.scrollTop = target.scrollHeight - target.offsetHeight;
        initialScrollBehaviorRef.current = false;

        return;
      }

      // This is very similar to scrollToEnd().
      // Instead of scrolling to end, it will call props.scroller() to determines how far it should scroll.
      // This function could be called while it is auto-scrolling.

      const { offsetHeight, scrollHeight, scrollTop } = target;

      const maxValue = Math.max(0, scrollHeight - offsetHeight - scrollTop);

      const rawNextValue = DEFAULT_SCROLLER();

      const nextValue = Math.max(0, Math.min(maxValue, rawNextValue));

      let nextAnimateTo;

      if (nextValue !== maxValue) {
        nextAnimateTo = scrollTop + nextValue;
      } else {
        // When scrolling to bottom, we should scroll to "100%".
        // Otherwise, if we scroll to any number, it will lose stickiness when elements are adding too fast.
        // "100%" is a special argument intended to make sure stickiness is not lost while new elements are being added.
        nextAnimateTo = '100%';
      }

      scrollTo(nextAnimateTo, { behavior: 'smooth' });
    }
  }, [animateFromRef, scrollTo, targetRef]);

  const handleScroll = useCallback(
    ({ timeStampLow }: { timeStampLow: number }) => {
      const { current: animateTo } = animateToRef;
      const { current: target } = targetRef;

      const animating = animateTo !== null;

      // Currently, there are no reliable way to check if the "scroll" event is trigger due to
      // user gesture, programmatic scrolling, or Chrome-synthesized "scroll" event to compensate size change.
      // Thus, we use our best-effort to guess if it is triggered by user gesture, and disable sticky if it is heading towards the start direction.

      if (timeStampLow <= ignoreScrollEventBeforeRef.current || !target) {
        // Since we debounce "scroll" event, this handler might be called after spineTo.onEnd (a.k.a. artificial scrolling).
        // We should ignore debounced event fired after scrollEnd, because without skipping them, the userInitiatedScroll calculated below will not be accurate.
        // Thus, on a fast machine, adding elements super fast will lose the "stickiness".

        return;
      }

      const { atEnd } = computeViewState({
        target,
      });

      // Chrome will emit "synthetic" scroll event if the container is resized or an element is added
      // We need to ignore these "synthetic" events
      // Repro: In playground, press 4-1-5-1-1 (small, add one, normal, add one, add one)
      //        Nomatter how fast or slow the sequence is being pressed, it should still stick to the bottom
      const { offsetHeight: nextOffsetHeight, scrollHeight: nextScrollHeight } =
        target;
      const { current: offsetHeight } = offsetHeightRef;
      const { current: scrollHeight } = scrollHeightRef;
      const offsetHeightChanged = nextOffsetHeight !== offsetHeight;
      const scrollHeightChanged = nextScrollHeight !== scrollHeight;

      if (offsetHeightChanged) {
        offsetHeightRef.current = nextOffsetHeight;
      }

      if (scrollHeightChanged) {
        scrollHeightRef.current = nextScrollHeight;
      }

      // Sticky means:
      // - If it is scrolled programatically, we are still in sticky mode
      // - If it is scrolled by the user, then sticky means if we are at the end

      // Only update stickiness if the scroll event is not due to synthetic scroll done by Chrome
      if (!offsetHeightChanged && !scrollHeightChanged) {
        // We are sticky if we are animating to the end, or we are already at the end.
        // We can be "animating but not sticky" by calling "scrollTo(100)" where the container scrollHeight is 200px.
        const nextSticky = (animating && animateTo === '100%') || atEnd;

        if (stickyRef.current !== nextSticky) {
          setSticky(nextSticky);
        }
      } else if (stickyRef.current) {
        scrollToSticky();
      }

      const { scrollTop: actualScrollTop } = target;

      scrollPositionObserversRef.current.forEach((observer) =>
        observer({ scrollTop: actualScrollTop }),
      );
    },
    [
      animateToRef,
      ignoreScrollEventBeforeRef,
      offsetHeightRef,
      scrollHeightRef,
      scrollPositionObserversRef,
      scrollToSticky,
      setSticky,
      stickyRef,
      targetRef,
    ],
  );

  useEffect(() => {
    if (target) {
      let stickyButNotAtEndSince: false | number = false;

      const timeout = setImmediateInterval(
        () => {
          const { current: target } = targetRef;
          const animating = animateToRef.current !== null;

          if (stickyRef.current) {
            if (!computeViewState({ target }).atEnd) {
              if (!stickyButNotAtEndSince) {
                stickyButNotAtEndSince = Date.now();
              } else if (
                Date.now() - stickyButNotAtEndSince >
                SCROLL_DECISION_DURATION
              ) {
                // Quirks: In Firefox, after user scroll down, Firefox do two things:
                //         1. Set to a new "scrollTop"
                //         2. Fire "scroll" event
                //         For what we observed, #1 is fired about 20ms before #2. There is a chance that this stickyCheckTimeout is being scheduled between 1 and 2.
                //         That means, if we just look at #1 to decide if we should scroll, we will always scroll, in oppose to the user's intention.
                // Repro: Open Firefox, set checkInterval to a lower number, and try to scroll by dragging the scroll handler. It will jump back.

                // The "animating" check will make sure stickiness is not lost when elements are adding at a very fast pace.
                if (!animating) {
                  animateFromRef.current = target.scrollTop;
                  scrollToSticky();
                }

                stickyButNotAtEndSince = false;
              }
            } else {
              stickyButNotAtEndSince = false;
            }
          } else if (
            target.scrollHeight <= target.offsetHeight &&
            !stickyRef.current
          ) {
            // When the container is emptied, we will set sticky back to true.

            setSticky(true);
          }
        },
        Math.max(MIN_CHECK_INTERVAL, 100) || MIN_CHECK_INTERVAL,
      );

      return () => clearInterval(timeout);
    }
  }, [animateToRef, scrollToSticky, setSticky, stickyRef, target, targetRef]);

  const internalContext = useMemo(
    () => ({
      setTarget,
      target,
    }),
    [setTarget, target],
  );

  const functionContext = useMemo(
    () => ({
      scrollToBottom,
    }),
    [scrollToBottom],
  );

  useEffect(() => {
    // We need to update the "scrollHeight" value to latest when the user do a focus inside the box.
    //
    // This is because:
    // - In our code that mitigate Chrome synthetic scrolling, that code will look at whether "scrollHeight" value is latest or not.
    // - That code only run on "scroll" event.
    // - That means, on every "scroll" event, if the "scrollHeight" value is not latest, we will skip modifying the stickiness.
    // - That means, if the user "focus" to an element that cause the scroll view to scroll to the bottom, the user agent will fire "scroll" event.
    //   Since the "scrollHeight" is not latest value, this "scroll" event will be ignored and stickiness will not be modified.
    // - That means, if the user "focus" to a newly added element that is at the end of the scroll view, the "scroll to bottom" button will continue to show.
    //
    // Repro in Chrome:
    // 1. Fill up a scroll view
    // 2. Scroll up, the "scroll to bottom" button should show up
    // 3. Click "Add a button"
    // 4. Click on the scroll view (to pseudo-focus on it)
    // 5. Press TAB, the scroll view will be at the bottom
    //
    // Expect:
    // - The "scroll to bottom" button should be gone.
    if (target) {
      const handleFocus = () => {
        scrollHeightRef.current = target.scrollHeight;
      };

      target.addEventListener('focus', handleFocus, {
        capture: true,
        passive: true,
      });

      return () => target.removeEventListener('focus', handleFocus);
    }
  }, [target]);

  return (
    <InternalContext.Provider value={internalContext}>
      <FunctionContext.Provider value={functionContext}>
        {children}
        {target && (
          <EventSpy
            debounce={17}
            name="scroll"
            onEvent={handleScroll}
            target={target}
          />
        )}
        {target && animateTo !== null && (
          <SpineTo
            name="scrollTop"
            onEnd={handleSpineToEnd}
            target={target}
            value={animateTo}
          />
        )}
      </FunctionContext.Provider>
    </InternalContext.Provider>
  );
};

export default Composer;
