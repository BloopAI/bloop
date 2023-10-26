export function polling(func: () => Promise<any>, interval: number): number {
  let intervalId: number | null = null;
  let isRequestInProgress = false;

  const poll = async () => {
    if (!isRequestInProgress) {
      isRequestInProgress = true;
      try {
        await func();
      } catch (error) {
        console.error(error);
      } finally {
        isRequestInProgress = false;
      }
    }
  };

  poll();
  intervalId = window.setInterval(poll, interval);

  return intervalId;
}
