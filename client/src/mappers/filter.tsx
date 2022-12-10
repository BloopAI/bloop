import { SearchResponseStats } from '../types/api';
import { FilterName, FilterType } from '../types/general';

const filterNameTitleMap: Record<string, string> = {
  [FilterName.LANGUAGE]: 'Language',
  [FilterName.PATH]: 'Path',
  [FilterName.REPOSITORY]: 'Repository',
  [FilterName.ORGANISATION]: 'Organisation',
};

export const mapFiltersData = (
  data: SearchResponseStats,
  filters: FilterType[],
): FilterType[] => {
  return Object.entries(data).map(([key, value]) => {
    return {
      title: filterNameTitleMap[key],
      type: 'checkbox' as const,
      name: key as FilterName,
      items: Object.entries(value)
        .map(([repo, items]: [string, any]) => ({
          checked: !!filters
            .find((item) => item.name === key)
            ?.items.find((item) => item.label === repo)?.checked,
          label: repo,
          description: items.toString(),
        }))
        .sort((a, b) => (a.label === b.label ? 0 : a.label < b.label ? -1 : 1)),
    };
  });
};
