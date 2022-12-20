import { FileTreeFileType, RepositoryFile, RepoSource } from '../types';

export const sortFiles = (a: RepositoryFile, b: RepositoryFile) => {
  if (a.type != b.type) {
    return a.type === FileTreeFileType.DIR ? -1 : 1;
  }
  return a.name.toString().localeCompare(b.name);
};

export const getFileName = (path: string) => path.split('/').reverse()[0];

export const getRepoSource = (repoRef: string): RepoSource => {
  const p = repoRef.split('/')[0];
  if (p === 'github.com') {
    return RepoSource.GH;
  } else {
    return RepoSource.LOCAL;
  }
};

export const cleanRepoName = (repoName: string) =>
  repoName.replace('github.com/', '');
