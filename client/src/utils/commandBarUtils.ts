import {
  CommandBarItemCustomType,
  CommandBarItemGeneralType,
  CommandBarSectionType,
} from '../types/general';

export const bubbleUpRecentItems = (
  sections: CommandBarSectionType[],
  recentKeys: string[],
  recentLabel: string,
): CommandBarSectionType[] => {
  const newSections: CommandBarSectionType[] = [];
  const recentItems: (CommandBarItemGeneralType | CommandBarItemCustomType)[] =
    [];
  sections.forEach((s) => {
    recentItems.push(
      ...s.items.filter((item) => recentKeys.includes(item.key)),
    );
  });
  if (recentItems.length) {
    newSections.push({
      label: recentLabel,
      items: recentItems.sort(
        (a, b) => recentKeys.indexOf(b.key) - recentKeys.indexOf(a.key),
      ),
      itemsOffset: 0,
      key: 'recent-items',
    });
  }
  sections.forEach((s) => {
    const newItems = s.items.filter((item) => !recentKeys.includes(item.key));
    if (newItems.length) {
      newSections.push({
        ...s,
        items: newItems,
        itemsOffset: newSections[newSections.length - 1]
          ? newSections[newSections.length - 1].items.length +
            newSections[newSections.length - 1].itemsOffset
          : 0,
      });
    }
  });
  return newSections;
};
