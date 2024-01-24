export const tutorialSteps = [
  {
    title: 'Adding repository',
    description: 'Projects require at least one synced repository.',
    hint: ['Start by selecting ', 'Add new repository'],
  },
  {
    title: 'Repository types',
    description:
      'You can add 3 types of repositories, private, public and local.',
    hint: ['Start by selecting a type repository you would like to index.'],
  },
  {
    title: 'Indexing repositories',
    description:
      'Bloop needs to index your repository first. This process takes a few seconds and happens only one time per repository.',
    hint: [
      'Start by selecting a repository and pressing Enter (↵) on your keyboard.',
    ],
  },
  {
    title: 'Indexing in progress',
    description:
      '{{repoName}} is currently indexing as soon as it is finished you will be able to add it to your project.',
    hint: [],
  },
  {
    title: 'Add to project',
    description:
      '{{repoName}} has finished indexing and you can use it in your projects now.',
    hint: ['Start by selecting again and pressing Enter (↵) on your keyboard.'],
  },
];
