import { useCallback, useLayoutEffect, useRef } from 'react';

function squareStepper(current: number, to: number) {
  const sign = Math.sign(to - current);
  const step = Math.sqrt(Math.abs(to - current));
  const next = current + step * sign;

  if (sign > 0) {
    return Math.min(to, next);
  }

  return Math.max(to, next);
}

function step(
  from: number,
  to: number,
  stepper: (c: number, to: number) => number,
  index: number,
) {
  let next = from;

  for (let i = 0; i < index; i++) {
    next = stepper(next, to);
  }

  return next;
}

type Props = {
  name: string;
  onEnd: (b: boolean) => void;
  target: any;
  value: number | '100%';
};

const SpineTo = ({ name, onEnd, target, value }: Props) => {
  const animator = useRef<number>();

  const animate = useCallback(
    (
      name: string,
      from: number,
      to: number | string,
      index: number,
      start = Date.now(),
    ) => {
      if (to === '100%' || typeof to === 'number') {
        if (animator.current) {
          cancelAnimationFrame(animator.current);
        }

        animator.current = requestAnimationFrame(() => {
          if (target) {
            const toNumber =
              to === '100%' ? target.scrollHeight - target.offsetHeight : to;
            let nextValue = step(
              from,
              toNumber,
              squareStepper,
              (Date.now() - start) / 5,
            );

            if (Math.abs(toNumber - nextValue) < 1.5) {
              nextValue = toNumber;
            }

            target[name] = nextValue;

            if (toNumber === nextValue) {
              onEnd && onEnd(true);
            } else {
              animate(name, from, to, index + 1, start);
            }
          }
        });
      }
    },
    [animator, onEnd, target],
  );

  const handleCancelAnimation = useCallback(() => {
    if (animator.current) {
      cancelAnimationFrame(animator.current);
    }
    onEnd && onEnd(false);
  }, [onEnd]);

  useLayoutEffect(() => {
    animate(name, target[name], value, 1);

    if (target) {
      target.addEventListener('pointerdown', handleCancelAnimation, {
        passive: true,
      });
      target.addEventListener('wheel', handleCancelAnimation, {
        passive: true,
      });

      return () => {
        target.removeEventListener('pointerdown', handleCancelAnimation);
        target.removeEventListener('wheel', handleCancelAnimation);
        if (animator.current) {
          cancelAnimationFrame(animator.current);
        }
      };
    }

    return () => animator.current && cancelAnimationFrame(animator.current);
  }, [animate, animator, handleCancelAnimation, name, target, value]);

  return null;
};

export default SpineTo;
