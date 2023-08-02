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
        <div className="article-response relative padding-start">
          <MarkdownWithCode
            openFileModal={openFileModal}
            repoName={repoName}
            markdown={markdown}
            hideCode
          />
          <div className="w-6 h-6 rounded-full bg-chat-bg-border overflow-hidden flex items-center justify-center select-none absolute top-0 left-0">
            <div className="w-3 h-3">
              <Sparkles raw />
            </div>
          </div>
          <Button
            variant="secondary"
            size="small"
            onClick={() => copyToClipboard(markdown)}
            className="absolute top-0 right-0"
          >
            <CopyMD /> Copy
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
