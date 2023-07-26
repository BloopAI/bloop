export const mapLoadingSteps = (
  searchSteps: { type: string; content: string }[],
  t: (key: string) => string,
) => {
  return searchSteps.map((s: { type: string; content: string }) => ({
    ...s,
    displayText:
      s.type === 'PROC'
        ? t(`Reading`) +
          ' ' +
          `${s.content.call.length > 20 ? '...' : ''}${s.content.call.slice(
            -20,
          )}`
        : s.content.call,
  }));
};
