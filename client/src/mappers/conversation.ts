import { SearchStepType } from '../types/api';

export const mapLoadingSteps = (
  searchSteps: SearchStepType[],
  t: (key: string) => string,
  paths: string[],
) => {
  return searchSteps
    .map((s) => {
      if (s.type === 'proc') {
        return s.content.paths.map((pa) => ({
          ...s,
          path: paths[pa] || '',
          displayText:
            t(`Reading`) +
            ' ' +
            `${paths[pa]?.length > 20 ? '...' : ''}${paths[pa]?.slice(-20)}`,
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
