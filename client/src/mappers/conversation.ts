import flatten from 'lodash.flatten';
import { SearchStepType } from '../types/api';
import { ChatLoadingStep } from '../types/general';

export const mapLoadingSteps = (
  searchSteps: SearchStepType[],
  t: (key: string) => string,
) => {
  const arr: (ChatLoadingStep | ChatLoadingStep[])[] = searchSteps.map((s) => {
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
  });
  return flatten(arr);
};
