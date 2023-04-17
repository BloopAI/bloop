import { MouseEvent } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { RepoType, RepoUi } from '../types/general';
import langs from './langs.json';

export const copyToClipboard = (value: string) => {
  // navigator clipboard api needs a secure context (https)
  if (
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === 'function' &&
    window.isSecureContext
  ) {
    return navigator.clipboard.writeText(value).then();
  } else {
    let textArea = document.createElement('textarea');
    textArea.value = value;
    // make the textarea out of viewport
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    return new Promise((res, rej) => {
      document.execCommand('copy') ? res(true) : rej();
      textArea.remove();
    });
  }
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

export function groupReposByParentFolder(repos: RepoType[]): RepoUi[] {
  const isWindows = repos?.[0]?.ref ? isWindowsPath(repos[0].ref) : false;
  // Extract unique parent folders
  const parentFolders = Array.from(
    new Set(
      repos.map((obj) =>
        obj.ref
          .split(isWindows ? '\\' : '/')
          .slice(0, -1)
          .join(isWindows ? '\\' : '/'),
      ),
    ),
  );

  // Group repos by parent folder
  const groupedObjects: {
    [parentFolder: string]: string[];
  } = {};
  for (const parentFolder of parentFolders) {
    groupedObjects[parentFolder] = repos
      .filter((obj) => obj.ref.startsWith(parentFolder + '/'))
      .map((r) => r.ref);
  }

  // Add folderName property to each repo
  const objectsWithFolderName: RepoUi[] = repos.map((r) => {
    const folderName =
      Object.entries(groupedObjects)
        .filter(([folder, repos]) => repos.includes(r.ref))
        .sort((a, b) => (a[0].length < b[0].length ? -1 : 1))
        .pop()?.[0] || isWindows
        ? '\\'
        : '/';
    return {
      ...r,
      folderName,
      selected: true,
      shortName: r.name,
    };
  });

  const commonFolder = getCommonFolder(
    objectsWithFolderName.map((lr) => lr.folderName),
  )
    .split(isWindows ? '\\' : '/')
    .slice(0, -1)
    .join(isWindows ? '\\' : '/');

  return objectsWithFolderName.map((r) => ({
    ...r,
    folderName: r.folderName.replace(commonFolder, ''),
  }));
}

export const getCommonFolder = (paths: string[]) => {
  if (!paths?.length) {
    return '/';
  }
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
  return uuidv4();
};

export const propsAreShallowEqual = <P>(
  prevProps: Readonly<P>,
  nextProps: Readonly<P>,
) =>
  Object.keys(prevProps).every(
    (k) =>
      prevProps[k as keyof typeof prevProps] ===
      nextProps[k as keyof typeof nextProps],
  );

export const deleteAuthCookie = () => {
  document.cookie = 'auth_cookie=;expires=Thu, 01 Jan 1970 00:00:01 GMT;';
};
