import { useEffect, useRef, useState } from 'react';

const InputLoader = ({ loadingSteps }: { loadingSteps: string[] }) => {
  const [state, setState] = useState(-1);
  const steps = useRef(loadingSteps);

  useEffect(() => {
    steps.current = loadingSteps;
  }, [loadingSteps]);

  useEffect(() => {
    let currentLoadingItemIndex = -1; // Start by showing the first loading item
    let currentLoadingItemState = 2;
    function animate() {
      if (currentLoadingItemState === 0) {
        // Going from 0 -> 50%, check if there's another item yet
        if (steps.current[currentLoadingItemIndex + 1]) {
          // There is another item, move to 100%
          currentLoadingItemState = 2;
        } else {
          currentLoadingItemState = 1;
        }
      } else if (currentLoadingItemState === 1) {
        // Go from 50% -> 90%
        if (steps.current[currentLoadingItemIndex + 1]) {
          // There is another item, move to 100%
          currentLoadingItemState = 3;
        }
      } else if (currentLoadingItemState === 2) {
        // Go from 50% -> 100%
        currentLoadingItemIndex++;
        currentLoadingItemState = 0;
      } else if (currentLoadingItemState === 3) {
        // Go from 90% -> 100%
        currentLoadingItemIndex++;
        currentLoadingItemState = 0;
      }
      setState(currentLoadingItemState);
    }
    (function animationLoop(i) {
      setTimeout(function () {
        animate();
        if (--i) animationLoop(i);
      }, 500);
    })(100);
  }, []);

  return (
    <div className="absolute top-0 left-0 right-0 bottom-0">
      <div
        className={`bg-chat-bg-border/50 h-full ${
          state === 1 ? 'w-[90%]' : ''
        } ${
          [
            'animate-loader-state-zero',
            'animate-loader-state-one',
            'animate-loader-state-two',
            'animate-loader-state-three',
          ][state]
        }`}
      />
    </div>
  );
};

export default InputLoader;
