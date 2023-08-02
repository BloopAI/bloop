import React, { useContext, useState } from 'react';
import MarkdownWithCode from '../../components/MarkdownWithCode';
import { CopyMD, Sparkles } from '../../icons';
import { FileModalContext } from '../../context/fileModalContext';
import { copyToClipboard } from '../../utils';
import Button from '../../components/Button';

type Props = {
  repoName: string;
  markdown: string;
};

const FileExplanation = ({ repoName, markdown }: Props) => {
  const [width, setWidth] = useState(384);
  const { openFileModal } = useContext(FileModalContext);
  const handleResize = (e: React.MouseEvent) => {
    e.stopPropagation();
    const startWidth = width;
    const startPosition = e.pageX;

    function onMouseMove(mouseMoveEvent: MouseEvent) {
      mouseMoveEvent.preventDefault();
      setWidth(() =>
        Math.min(
          Math.max(startWidth + startPosition - mouseMoveEvent.pageX, 200),
          window.innerWidth - 200,
        ),
      );
    }
    function onMouseUp(e: MouseEvent) {
      e.stopPropagation();
      document.body.removeEventListener('mousemove', onMouseMove);
      document.body.removeEventListener('mouseup', onMouseUp, true);
    }

    document.body.addEventListener('mousemove', onMouseMove);
    document.body.addEventListener('mouseup', onMouseUp, true);
  };
  return (
    <div className="overflow-auto" style={{ width }}>
      <div className="w-full p-5 body-m text-label-base pb-44 break-word relative">
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
        <div
          className="absolute top-0 bottom-0 left-0 w-2 border-l border-bg-border hover:border-bg-main cursor-w-resize"
          onMouseDown={handleResize}
        />
      </div>
    </div>
  );
};

export default FileExplanation;
