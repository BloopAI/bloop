import React, { useContext, useState } from 'react';
import MarkdownWithCode from '../../components/MarkdownWithCode';
import { CopyMD, Sparkles } from '../../icons';
import { FileModalContext } from '../../context/fileModalContext';
import { copyToClipboard } from '../../utils';
import Button from '../../components/Button';
import {
  getPlainFromStorage,
  RIGHT_SIDEBAR_WIDTH_KEY,
  savePlainToStorage,
} from '../../services/storage';
import useResizeableWidth from '../../hooks/useResizeableWidth';

type Props = {
  repoName: string;
  markdown: string;
};

const FileExplanation = ({ repoName, markdown }: Props) => {
  const { openFileModal } = useContext(FileModalContext);
  const { width, handleResize } = useResizeableWidth(
    RIGHT_SIDEBAR_WIDTH_KEY,
    384,
    true,
  );

  return (
    <div className="min-h-full w-full relative" style={{ width }}>
      <div className="w-full p-5 body-m text-label-base pb-44 break-word overflow-auto h-full">
        <div className="article-response relative padding-start group-custom">
          <MarkdownWithCode
            openFileModal={openFileModal}
            repoName={repoName}
            markdown={markdown}
            hideCode
          />
          <Button
            variant="secondary"
            size="tiny"
            onClick={() => copyToClipboard(markdown)}
            className="absolute top-0 right-0 opacity-0 group-custom-hover:opacity-100 transition-opacity"
          >
            <CopyMD raw sizeClassName="w-3.5 h-3.5" /> Copy
          </Button>
        </div>
      </div>
      <div
        className="absolute top-0 bottom-0 left-0 w-2 border-l border-bg-border hover:border-bg-main cursor-col-resize"
        onMouseDown={handleResize}
      />
    </div>
  );
};

export default FileExplanation;
