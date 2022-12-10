import { FileTreeFileType, RepositoryFile } from '../types';

export const sortFiles = (a: RepositoryFile, b: RepositoryFile) => {
  if (a.type != b.type) {
    return a.type === FileTreeFileType.DIR ? -1 : 1;
  }
  return a.name.toString().localeCompare(b.name);
};
