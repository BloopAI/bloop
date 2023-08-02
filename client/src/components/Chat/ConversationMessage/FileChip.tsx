import React, { MutableRefObject, useContext, useEffect, useRef } from 'react';
import FileIcon from '../../FileIcon';
import { ArrowOut } from '../../../icons';
import { FileHighlightsContext } from '../../../context/fileHighlightsContext';
import { highlightColors } from '../../../consts/code';

type Props = {
  onClick: () => void;
  fileName: string;
  filePath: string;
  skipIcon?: boolean;
  lines?: [number, number];
  fileChips?: MutableRefObject<HTMLButtonElement[]>;
};

let isRendered = false;
const FileChip = ({
  onClick,
  fileName,
  filePath,
  skipIcon,
  lines,
  fileChips,
}: Props) => {
  const ref = useRef<HTMLButtonElement>(null);
  const { setFileHighlights } = useContext(FileHighlightsContext);

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
    if (lines && index > -1) {
      setFileHighlights((prev) => {
        const newHighlights = { ...prev };
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
        // newHighlights[filePath] = newHighlights[filePath].filter((h) => !!h);
        if (JSON.stringify(prev) === JSON.stringify(newHighlights)) {
          return prev;
        }
        return newHighlights;
      });
    }
  }, [lines, filePath, index]);

  return (
    <button
      className={`inline-flex items-center bg-chat-bg-shade rounded-4 overflow-hidden 
                text-label-base hover:text-label-title border border-transparent hover:border-chat-bg-border 
                cursor-pointer align-middle ellipsis`}
      ref={ref}
      onClick={onClick}
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
