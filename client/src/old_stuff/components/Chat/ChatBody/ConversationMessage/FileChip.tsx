import React, {
  Dispatch,
  MutableRefObject,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from 'react';
import FileIcon from '../../../../../components/FileIcon';
import { ArrowOut } from '../../../../../icons';
import { highlightColors } from '../../../../../consts/code';
import { FileHighlightsType } from '../../../../types/general';

type Props = {
  onClick: () => void;
  fileName: string;
  filePath: string;
  skipIcon?: boolean;
  lines?: [number, number];
  fileChips?: MutableRefObject<HTMLButtonElement[]>;
  setFileHighlights?: Dispatch<SetStateAction<FileHighlightsType>>;
  setHoveredLines?: Dispatch<SetStateAction<[number, number] | null>>;
};

const FileChip = ({
  onClick,
  fileName,
  filePath,
  skipIcon,
  lines,
  fileChips,
  setFileHighlights,
  setHoveredLines,
}: Props) => {
  const ref = useRef<HTMLButtonElement>(null);
  const [isHovered, setHovered] = useState(false);
  const [, setRendered] = useState(false);

  useEffect(() => {
    // a hack to make this component rerender once when fileChips are updated
    setRendered(true);
  }, []);

  useEffect(() => {
    let chip = ref.current;
    if (chip && fileChips) {
      fileChips.current.push(chip);
    }

    return () => {
      if (chip && fileChips) {
        const index = fileChips.current.indexOf(chip);
        if (index !== -1) {
          fileChips.current.splice(index, 1);
        }
      }
    };
  }, []);

  const index =
    ref.current && fileChips ? fileChips.current.indexOf(ref.current) : -1;

  useEffect(() => {
    if (lines && index === 0 && filePath) {
      if (fileChips?.current?.length === 1) {
        onClick();
      }
    }
  }, [index, lines, filePath]);

  useEffect(() => {
    if (lines && index > -1 && setFileHighlights) {
      setFileHighlights((prev) => {
        const newHighlights = JSON.parse(JSON.stringify(prev));
        if (!newHighlights[filePath]) {
          newHighlights[filePath] = [];
        }
        newHighlights[filePath][index] = {
          lines,
          color: `rgb(${highlightColors[index % highlightColors.length].join(
            ', ',
          )})`,
          index,
        };
        if (JSON.stringify(prev) === JSON.stringify(newHighlights)) {
          return prev;
        }
        return newHighlights;
      });
    }
  }, [lines, filePath, index]);

  useEffect(() => {
    if (setHoveredLines && lines && index > -1) {
      setHoveredLines((prev) => {
        if (
          isHovered &&
          (!prev || prev[0] !== lines[0] || prev[1] !== lines[1])
        ) {
          return lines;
        }
        if (
          !isHovered &&
          prev &&
          prev[0] === lines[0] &&
          prev[1] === lines[1]
        ) {
          return null;
        }
        return prev;
      });
    }
  }, [isHovered]);

  return (
    <button
      className={`inline-flex items-center bg-chat-bg-base rounded-4 overflow-hidden 
                text-label-title hover:text-label-title border border-transparent hover:border-chat-bg-border 
                cursor-pointer align-middle ellipsis`}
      ref={ref}
      onClick={onClick}
      onMouseLeave={() => (setHoveredLines ? setHovered(false) : {})}
      onMouseEnter={() => (setHoveredLines ? setHovered(true) : {})}
    >
      {!!lines && (
        <span
          className="w-0.5 h-4 ml-1 rounded-px"
          style={{
            width: 2,
            height: 14,
            backgroundColor: `rgb(${
              index > -1
                ? highlightColors[index % highlightColors.length].join(', ')
                : ''
            })`,
          }}
        />
      )}
      <span className="flex gap-1 px-1 py-0.5 items-center border-r border-chat-bg-border code-s ellipsis">
        {!skipIcon && <FileIcon filename={fileName} noMargin />}
        <span className="ellipsis">{fileName}</span>
      </span>
      <span className="p-1 inline-flex items-center justify-center">
        <ArrowOut sizeClassName="w-3.5 h-3.5" />
      </span>
    </button>
  );
};

export default FileChip;
