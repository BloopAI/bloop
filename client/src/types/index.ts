declare global {
  // eslint-disable-next-line no-unused-vars
  interface Window {
    __APP_SESSION__: string | number;
  }
}

export interface Commit {
  message: string;
  author: string;
  image?: string;
  datetime: number;
  hash: string;
}
export enum FileTreeFileType {
  FILE,
  DIR,
}
export interface RepositoryFile {
  name: string;
  path: string;
  type: FileTreeFileType;
  // children: RepositoryFile[];
  // commit: Commit;
  lang?: string;
}

export interface RepositoryBranch {
  name: string;
  commit: Commit;
  files: number;
  active?: boolean;
  main?: boolean;
}

export enum RepoSource {
  GH,
  LOCAL,
}

export interface Repository {
  url: string;
  name: string;
  description: string;
  fileCount: number;
  commits: Commit[];
  branches: RepositoryBranch[];
  followers: number;
  files: RepositoryFile[];
  currentPath: string;
  source: RepoSource;
}

export type Theme =
  | 'default'
  | 'default-light'
  | 'vsc-default-dark'
  | 'vsc-default-light'
  | 'atom-one-dark-pro'
  | 'abyss'
  | 'darcula'
  | 'dracula'
  | 'github-dark'
  | 'github-light'
  | 'gruvbox-dark'
  | 'gruvbox-light'
  | 'kimbie-dark'
  | 'material'
  | 'night-owl'
  | 'quiet-light'
  | 'solarized-dark'
  | 'solarized-light'
  | 'tomorrow-night-blue'
  | 'monokai';
