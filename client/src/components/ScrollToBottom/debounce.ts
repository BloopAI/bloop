export default function (fn: (args: any) => void, ms: number) {
  if (!ms) {
    return fn;
  }

  let last = 0;
  let timeout: number | null = null;

  return (...args: any[]) => {
    const now = Date.now();

    if (now - last > ms) {
      // @ts-ignore
      fn(...args);
      last = now;
    } else {
      if (timeout) {
        clearTimeout(timeout);
      }

      timeout = window.setTimeout(
        () => {
          // @ts-ignore
          fn(...args);
          last = Date.now();
        },
        Math.max(0, ms - now + last),
      );
    }
  };
}
