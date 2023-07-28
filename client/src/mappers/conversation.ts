export const mapLoadingSteps = (
  searchSteps: { type: string; content: { call: string } }[],
  t: (key: string) => string,
) => {
  return searchSteps.map((s) => ({
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
