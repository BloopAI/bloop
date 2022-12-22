import React from 'react';
import { GitHubLogo } from '../icons';
import { FilterName, FilterType } from '../types/general';
import { FileTreeFileType, Repository, RepoSource } from '../types';

export const mockFiltersInitial: FilterType[] = [
  {
    title: 'Repository',
    name: 'repo' as FilterName,
    items: [
      {
        label: 'shamu-rsh',
        description: '3,500',
        checked: false,
        icon: <GitHubLogo />,
      },
      {
        label: 'migrations',
        description: '12',
        checked: false,
        icon: <GitHubLogo />,
      },
      {
        label: 'client-apps',
        description: '1,300',
        checked: false,
        icon: <GitHubLogo />,
      },
      {
        label: 'symbol-resolve-parser',
        description: '12,000',
        checked: false,
        icon: <GitHubLogo />,
      },
    ],
    type: 'checkbox',
  },
  {
    title: 'Paths',
    name: 'path' as FilterName,
    items: [
      {
        label: 'src/javascript/components/button/button.jsx',
        description: '543',
        checked: false,
      },
      {
        label: 'src/javascript/components.js',
        description: '453',
        checked: false,
      },
      { label: 'src/styles/buttons.css', description: '1,300', checked: false },
      {
        label: 'src/backend/utils.ex',
        description: '234',
        checked: false,
      },
      {
        label: 'src/javascript/app.js',
        description: '171',
        checked: false,
      },
    ],
    type: 'checkbox',
  },
  {
    title: 'Commit',
    name: 'commit' as FilterName,
    items: [
      {
        label: 'shfbjhbsf',
        description: '4',
        checked: false,
      },
      {
        label: 'shbfvjshdbvgfjh',
        description: '12',
        checked: false,
      },
      { label: 'dfjsvjvdsfsf', description: '3', checked: false },
      {
        label: 'jdfhgbjdfsjh',
        description: '10',
        checked: false,
      },
      {
        label: 'sjhfsjhfbhhq',
        description: '2',
        checked: false,
      },
    ],
    type: 'checkbox',
  },
  {
    title: 'Languages',
    name: 'lang' as FilterName,
    items: [
      { label: 'JavaScript', description: '3,500', checked: false },
      { label: 'TypeScript', description: '12', checked: false },
      { label: 'Rust', description: '1,300', checked: false },
      {
        label: 'Python',
        description: '12,000',
        checked: false,
      },
    ],
    type: 'checkbox',
  },
];

export const mockCommits = [
  {
    message: 'feat: add more test files',
    author: 'Rascal Hogwards',
    image: '/avatar.png',
    datetime: 1666268938000,
    hash: '085bb3b',
  },
  {
    message: 'feat: add more test files',
    author: 'Rascal Hogwards',
    image: '/avatar.png',
    datetime: 1666258938000,
    hash: '075bb3b',
  },
  {
    message: 'feat: add more test files',
    author: 'Rascal Hogwards',
    image: '/avatar.png',
    datetime: 1666248938000,
    hash: '065bb3b',
  },
  {
    message: 'feat: add more test files',
    author: 'Rascal Hogwards',
    image: '/avatar.png',
    datetime: 1666238938000,
    hash: '055bb3b',
  },
  {
    message: 'feat: add more test files',
    author: 'Rascal Hogwards',
    image: '/avatar.png',
    datetime: 1666228938000,
    hash: '045bb3b',
  },
  //
  {
    message: 'feat: add more test files',
    author: 'Rascal Hogwards',
    image: '/avatar.png',
    datetime: 1666172538000,
    hash: '035bb3b',
  },
  {
    message: 'feat: add more test files',
    author: 'Rascal Hogwards',
    image: '/avatar.png',
    datetime: 1666162538000,
    hash: '025bb3b',
  },
  {
    message: 'feat: add more test files',
    author: 'Rascal Hogwards',
    image: '/avatar.png',
    datetime: 1666152538000,
    hash: '015bb3b',
  },
  {
    message: 'feat: add more test files',
    author: 'Rascal Hogwards',
    image: '/avatar.png',
    datetime: 1666142538000,
    hash: '185bb3b',
  },
  //
  {
    message: 'feat: add more test files',
    author: 'Rascal Hogwards',
    image: '/avatar.png',
    datetime: 1666096138000,
    hash: '285bb3b',
  },
  {
    message: 'feat: add more test files',
    author: 'Rascal Hogwards',
    image: '/avatar.png',
    datetime: 1666095138000,
    hash: '385bb3b',
  },
  {
    message: 'feat: add more test files',
    author: 'Rascal Hogwards',
    image: '/avatar.png',
    datetime: 1666094138000,
    hash: '485bb3b',
  },
  {
    message: 'feat: add more test files',
    author: 'Rascal Hogwards',
    image: '/avatar.png',
    datetime: 1666093138000,
    hash: '585bb3b',
  },
];

export const mockRepo: Repository = {
  description:
    'From startup to enterprise, choose the Bazel open source project to build and test your multi-language, multi-platform projects.',
  followers: 207,
  url: 'https://github.com/BloopAI/bloop',
  commits: mockCommits,
  currentPath: '',
  source: RepoSource.LOCAL,
  branches: [
    {
      name: 'main',
      commit: mockCommits[0],
      files: 3451,
      active: true,
      main: true,
    },
    { name: 'dev', commit: mockCommits[0], files: 3451, active: true },
    { name: 'testing-1', commit: mockCommits[0], files: 3451, active: false },
    { name: 'testing-2', commit: mockCommits[0], files: 3451, active: false },
  ],
  fileCount: 10,
  files: [
    {
      name: 'examples/',
      path: './src',
      type: FileTreeFileType.DIR,
      lang: '',
    },
    {
      name: 'userProfiles/',
      path: './src',
      type: FileTreeFileType.DIR,
      lang: '',
    },
    {
      name: 'searchAnnotation/',
      path: './src',
      type: FileTreeFileType.DIR,
      lang: '',
    },
    {
      name: 'searchEvaluation/',
      path: './src',
      type: FileTreeFileType.DIR,
      lang: '',
    },
    {
      name: 'stagedExamples/',
      path: './src',
      type: FileTreeFileType.DIR,
      lang: '',
    },
  ],
  name: 'Bloop',
};

export const contributors = [
  {
    name: 'Julia Frank',
    image: '/avatar.png',
    commits: 1574,
    additions: 517,
    deletions: 491,
  },
  {
    name: 'Julia Frank',
    image: '/avatar.png',
    commits: 1574,
    additions: 517,
    deletions: 491,
  },
  {
    name: 'Julia Frank',
    image: '/avatar.png',
    commits: 1574,
    additions: 517,
    deletions: 491,
  },
  {
    name: 'Julia Frank',
    image: '/avatar.png',
    commits: 1574,
    additions: 517,
    deletions: 491,
  },
  {
    name: 'Julia Frank',
    image: '/avatar.png',
    commits: 1574,
    additions: 517,
    deletions: 491,
  },
];

export const mockGitBlame = [
  {
    commit: mockCommits[0],
    lineRange: {
      start: 0,
      end: 3,
    },
  },
  {
    commit: mockCommits[0],
    lineRange: {
      start: 4,
      end: 6,
    },
  },
  {
    commit: mockCommits[0],
    lineRange: {
      start: 7,
      end: 8,
    },
  },
  {
    commit: mockCommits[0],
    lineRange: {
      start: 9,
      end: 12,
    },
  },
  {
    commit: mockCommits[0],
    lineRange: {
      start: 13,
      end: 17,
    },
  },
  {
    commit: mockCommits[0],
    lineRange: {
      start: 18,
      end: 20,
    },
  },
];
