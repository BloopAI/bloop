import { MouseEvent, useEffect, useState } from 'react';
import FileIcon from '../../FileIcon';
import Breadcrumbs, { PathParts } from '../../Breadcrumbs';
import { Range, ResultClick } from '../../../types/results';
import { breadcrumbsItemPath, isWindowsPath, splitPath } from '../../../utils';

type Props = {
  filePath: string;
  repoName: string;
  lines: number;
  onFileClick: ResultClick;
  highlights: Range[];
};

const SearchFile = ({
  filePath,
  lines,
  onFileClick,
  highlights,
  repoName,
}: Props) => {
  const [pathParts, setPathParts] = useState<PathParts[]>([]);

  const [hlRanges, setHlRanges] = useState<Record<number, number>>({});
  useEffect(() => {
    let bytes: Record<number, number> = {};
    highlights.forEach((hl) => {
      for (let i = hl.start; i < hl.end; i++) {
        bytes[i] = i;
      }
    });
    setHlRanges(bytes);
  }, [highlights]);

  useEffect(() => {
    const pathParts = splitPath(filePath);
    let index = 0;

    const pp: any[] = [];
    pathParts.forEach((path, pathIndex) => {
      const pathPart: PathParts = {
        label: path,
      };
      path.split('').forEach((c, cIndex) => {
        const charIndex = index + cIndex;
        if (hlRanges[charIndex] || hlRanges[charIndex] === 0) {
          if (pathPart.highlight?.start === undefined) {
            if (!pathPart.highlight) {
              pathPart.highlight = { start: 0, end: 0 };
            }
            pathPart.highlight.start = cIndex;
          }
          if (charIndex > pathPart.highlight.end) {
            pathPart.highlight.end = cIndex;
          }
        }
      });
      index += path.length - 1;
      index += 2;
      pathPart.onClick = (e: MouseEvent<HTMLButtonElement>) => {
        e.preventDefault();
        onFileClick(
          repoName,
          breadcrumbsItemPath(
            pathParts,
            pathIndex,
            isWindowsPath(filePath),
            pathIndex === pathParts.length - 1,
          ),
        );
      };
      pp.push(pathPart);
    });

    setPathParts(pp);
  }, [hlRanges, onFileClick]);
  return (
    <div className="flex flex-row w-full flex justify-between bg-gray-800 p-3 border border-gray-700 rounded-4 text-gray-500 items-center">
      <span className="flex flex-row gap-2 items-center w-full overflow-hidden">
        <FileIcon filename={filePath} />
        <div className="overflow-hidden flex-1">
          <Breadcrumbs
            activeStyle={'secondary'}
            pathParts={pathParts}
            path={filePath}
          />
        </div>
      </span>
    </div>
  );
};
export default SearchFile;
