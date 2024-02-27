import { RepositoryIcon } from '../icons';
import {
  CommandBarStepEnum,
  CommandBarItemGeneralType,
  CommandBarItemCustomType,
} from '../types/general';
import { newProjectShortcut } from '../consts/shortcuts';
import { bubbleUpRecentItems } from './commandBarUtils';

const items1: CommandBarItemGeneralType[] = [
  {
    label: 'Manage repositories',
    Icon: RepositoryIcon,
    id: CommandBarStepEnum.MANAGE_REPOS,
    key: CommandBarStepEnum.MANAGE_REPOS,
    shortcut: [],
    footerHint: '',
    footerBtns: [],
  },
  {
    label: 'Add new repository',
    Icon: RepositoryIcon,
    id: CommandBarStepEnum.ADD_NEW_REPO,
    key: CommandBarStepEnum.ADD_NEW_REPO,
    shortcut: ['cmd', 'A'],
    footerHint: '',
    footerBtns: [],
  },
  {
    label: 'New project',
    Icon: RepositoryIcon,
    id: CommandBarStepEnum.CREATE_PROJECT,
    key: CommandBarStepEnum.CREATE_PROJECT,
    shortcut: newProjectShortcut,
    footerHint: '',
    footerBtns: [],
  },
];

const items2: CommandBarItemGeneralType[] = [
  {
    label: `Account settings`,
    Icon: RepositoryIcon,
    id: `account-settings`,
    key: `account-settings`,
    shortcut: ['option', 'A'],
    footerHint: `Open account settings`,
    footerBtns: [],
  },
  {
    label: `Subscription`,
    Icon: RepositoryIcon,
    id: `subscription-settings`,
    key: `subscription-settings`,
    shortcut: ['option', 'S'],
    footerHint: `Open subscription settings`,
    footerBtns: [],
  },
];

const items3: CommandBarItemGeneralType[] = [
  {
    label: `Theme`,
    Icon: RepositoryIcon,
    id: CommandBarStepEnum.TOGGLE_THEME,
    key: CommandBarStepEnum.TOGGLE_THEME,
    shortcut: ['alt', '1'],
    footerHint: `Change application colour theme`,
    footerBtns: [],
  },
];

const sections = [
  {
    items: items1,
    itemsOffset: 0,
    label: 'Context',
    key: 'context-items',
  },
  {
    items: items2,
    itemsOffset: items1.length,
    label: 'Recent projects',
    key: 'recent-projects',
  },
  {
    items: items3,
    itemsOffset: items1.length + items2.length,
    label: 'Commands',
    key: 'general-commands',
  },
];

const recentLabel = 'Recent';

const testArrayIncludes = (
  arr: (CommandBarItemGeneralType | CommandBarItemCustomType)[],
  itemKey: string,
) => !!arr.find((a) => a.key === itemKey);

describe('commandBarUtils', () => {
  describe('bubbleUpRecentItems', () => {
    test('no recent items', () => {
      const result = bubbleUpRecentItems(sections, [], recentLabel);
      expect(result.length).toEqual(3);
      expect(result[0].items.length).toEqual(items1.length);
      expect(result[1].items.length).toEqual(items2.length);
      expect(result[2].items.length).toEqual(items3.length);
    });
    test('irrelevant recent items', () => {
      const result = bubbleUpRecentItems(
        sections,
        ['foo', 'bar', 'baz'],
        recentLabel,
      );
      expect(result.length).toEqual(3);
      expect(result[0].items.length).toEqual(items1.length);
      expect(result[1].items.length).toEqual(items2.length);
      expect(result[2].items.length).toEqual(items3.length);
    });
    test('1 recent item in section 1', () => {
      const key = items1[1].key;
      const result = bubbleUpRecentItems(sections, [key], recentLabel);
      expect(result.length).toEqual(4);
      expect(result[0].items.length).toEqual(1);
      expect(result[0].label).toEqual(recentLabel);
      expect(result[0].items[0].key).toEqual(key);
      expect(result[1].items.length).toEqual(items1.length - 1);
      expect(testArrayIncludes(result[1].items, key)).toBe(false);
      expect(result[2].items.length).toEqual(items2.length);
      expect(result[3].items.length).toEqual(items3.length);
    });
    test('1 recent item in section 1 + irrelevant', () => {
      const key = items1[1].key;
      const result = bubbleUpRecentItems(sections, [key, 'foo'], recentLabel);
      expect(result.length).toEqual(4);
      expect(result[0].items.length).toEqual(1);
      expect(result[0].label).toEqual(recentLabel);
      expect(result[0].items[0].key).toEqual(key);
      expect(result[1].items.length).toEqual(items1.length - 1);
      expect(testArrayIncludes(result[1].items, key)).toBe(false);
      expect(result[2].items.length).toEqual(items2.length);
      expect(result[3].items.length).toEqual(items3.length);
    });
    test('1 recent item in section 3', () => {
      const key = items3[0].key;
      const result = bubbleUpRecentItems(sections, [key], recentLabel);
      expect(result.length).toEqual(3);
      expect(result[0].items.length).toEqual(1);
      expect(result[0].label).toEqual(recentLabel);
      expect(result[0].items[0].key).toEqual(key);
      expect(result[1].items.length).toEqual(items1.length);
      expect(result[2].items.length).toEqual(items2.length);
    });
    test('recent items in different sections', () => {
      const key1 = items1[2].key;
      const key2 = items2[1].key;
      const key3 = items3[0].key;
      const recentKeysArr = [key3, key2, key1];
      const result = bubbleUpRecentItems(sections, recentKeysArr, recentLabel);
      expect(result.length).toEqual(3);
      expect(result[0].items.length).toEqual(recentKeysArr.length);
      expect(result[0].label).toEqual(recentLabel);
      expect(result[0].items[0].key).toEqual(key1);
      expect(result[0].items[1].key).toEqual(key2);
      expect(result[0].items[2].key).toEqual(key3);
      expect(result[1].items.length).toEqual(items1.length - 1);
      expect(testArrayIncludes(result[1].items, key1)).toBe(false);
      expect(result[2].items.length).toEqual(items2.length - 1);
      expect(testArrayIncludes(result[2].items, key2)).toBe(false);
    });
    test('all keys are recent', () => {
      const recentKeysArr = [
        ...items1.map((i) => i.key),
        ...items2.map((i) => i.key),
        ...items3.map((i) => i.key),
      ].reverse();
      const result = bubbleUpRecentItems(sections, recentKeysArr, recentLabel);
      expect(result.length).toEqual(1);
      expect(result[0].items.length).toEqual(recentKeysArr.length);
      expect(result[0].label).toEqual(recentLabel);
      expect(result[0].items[0].key).toEqual(items1[0].key);
    });
  });
});
