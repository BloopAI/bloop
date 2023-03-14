import { MouseEvent } from 'react';
import langs from './langs.json';

export const copyToClipboard = (value: string) => {
  navigator.clipboard.writeText(value).then();
};

/**
 * Returns a hash code from a string, only use for comparison as not secure
 * @param  {String} str The string to hash.
 * @return {Number}    A 32bit integer
 * @see http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/
 */
export const hashCode = (str: string) => {
  let hash = 0;
  for (let i = 0, len = str.length; i < len; i++) {
    let chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash;
};

export const parseFilters = (input: string) => {
  const regex = /((repo|lang):[^\s)]+)/gim;

  let m;
  const filters: Record<string, string[]> = {
    lang: [],
    repo: [],
  };

  while ((m = regex.exec(input)) !== null) {
    if (m.index === regex.lastIndex) {
      regex.lastIndex++;
    }
    if (m[2]) {
      filters[m[2]].push(m[1].split(':')[1]);
    }
  }
  return filters;
};

export const getFileExtensionForLang = (lang: string) => {
  if (!lang) {
    return 'default';
  }
  // @ts-ignore
  return 'index' + langs[lang]?.[0];
};

export const isWindowsPath = (path: string) => path.includes('\\');

export const breadcrumbsItemPath = (
  array: string[],
  index: number,
  isWindows: boolean,
  isFile?: boolean,
) => {
  const separator = isWindows ? '\\' : '/';
  const path = array.slice(0, index + 1).join(separator);

  const pathEnding = isFile ? '' : separator;
  return `${path}${pathEnding}`;
};

export const splitPath = (path: string) =>
  path?.split(isWindowsPath(path) ? '\\' : '/') || [];

export const splitPathForBreadcrumbs = (
  path: string,
  onClick?: (
    e: MouseEvent<HTMLButtonElement>,
    item: string,
    index: number,
    arr: string[],
  ) => void,
) => {
  return splitPath(path)
    .filter((p) => p !== '/')
    .map((item, index, arr) => ({
      label: item,
      onClick: (e: MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        onClick?.(e, item, index, arr);
      },
    }));
};

export const buildRepoQuery = (repo?: string, path?: string) => {
  return `open:true ${repo ? `repo:${repo}` : ''} ${
    path ? `path:${path}` : ''
  }`;
};

export const getFileManagerName = (os: string) => {
  switch (os) {
    case 'Darwin':
      return 'Finder';
    case 'Windows_NT':
      return 'File Explorer';
    default:
      return 'File manager';
  }
};

export const getCommonFolder = (paths: string[]) => {
  const pathParts = paths
    .map((p) => splitPath(p))
    .sort((a, b) => a.length - b.length);
  let commonFolder = [];

  for (let i = 0; i < pathParts[0].length; i++) {
    if (pathParts.every((pp) => pp[i] === pathParts[0][i])) {
      commonFolder.push(pathParts[0][i]);
    } else {
      break;
    }
  }
  return commonFolder.join(isWindowsPath(paths[0]) ? '\\' : '/');
};

export const arrayUnique = (array: any[], property: string) => {
  const unique: any = {};
  const distinct = [];
  for (const i in array) {
    if (typeof unique[array[i][property]] == 'undefined') {
      distinct.push(array[i]);
    }
    unique[array[i][property]] = 0;
  }
  return distinct;
};

export const generateUniqueId = (): string => {
  return hashCode(new Date().toISOString()).toString();
};

export const waitFor = async (milliseconds: number) => {
  await new Promise((res) => setTimeout(res, milliseconds));
};
