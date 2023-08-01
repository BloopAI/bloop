import { SearchStepType } from '../types/api';

export const mapLoadingSteps = (
  searchSteps: SearchStepType[],
  t: (key: string) => string,
) => {
  return searchSteps
    .map((s) => {
      if (s.type === 'proc') {
        return s.content.paths.map((pa) => ({
          ...s,
          path: pa || '',
          displayText:
            t(`Reading`) +
            ' ' +
            `${pa?.length > 20 ? '...' : ''}${pa?.slice(-20)}`,
        }));
      }
      return {
        ...s,
        path: s.content.query,
        displayText: s.content.query,
      };
    })
    .flat();
};
