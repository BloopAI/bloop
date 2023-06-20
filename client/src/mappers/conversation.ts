export const mapLoadingSteps = (
  searchSteps: { type: string; content: string }[],
) => {
  return searchSteps.map((s: { type: string; content: string }) => ({
    ...s,
    displayText:
      s.type === 'PROC'
        ? `Reading ${s.content.length > 20 ? '...' : ''}${s.content.slice(-20)}`
        : s.content,
  }));
};
