import React, { useState } from 'react';
import ModalOrSidebar from '../ModalOrSidebar';
import Breadcrumbs, { PathParts } from '../Breadcrumbs';
import Button from '../Button';
import { Clipboard, CloseSign, CursorSelection, MultiShare } from '../../icons';
import FileIcon from '../FileIcon';
import CodeFull from '../CodeBlock/CodeFull';
import ClearButton from '../ClearButton';
import { FullResult } from '../../types/results';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  result: FullResult | null;
  breadcrumbs: PathParts[];
  filePath: string | null;
};

const ShareFileModal = ({
  isOpen,
  onClose,
  result,
  breadcrumbs,
  filePath,
}: Props) => {
  const [isHintShown, setHintShown] = useState(true);
  return (
    <ModalOrSidebar
      isSidebar={false}
      shouldShow={isOpen}
      onClose={onClose}
      isModalSidebarTransition={false}
      setIsModalSidebarTransition={() => {}}
      containerClassName="w-[60vw]"
    >
      <div className="bg-gray-800 border-b border-gray-700 shadow-lighter flex items-center justify-between p-3">
        <h5>File share</h5>
        <div className="flex gap-2 items-center">
          <Button variant="secondary" onlyIcon title="Share multiple files">
            <MultiShare />
          </Button>
          <Button variant="primary">
            Copy link to file <Clipboard />
          </Button>
          <Button variant="tertiary" onlyIcon title="Close" onClick={onClose}>
            <CloseSign />
          </Button>
        </div>
      </div>
      <div className="border-b border-gray-700 p-3">
        <div className="flex items-center gap-1 overflow-hidden h-5">
          <FileIcon filename={result?.relativePath.slice(-5) || 'a.js'} />
          <Breadcrumbs
            pathParts={breadcrumbs}
            activeStyle="secondary"
            path={filePath || ''}
          />
        </div>
      </div>
      <div className="overflow-auto py-4 px-2 flex h-full relative">
        {isHintShown && (
          <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 flex items-center gap-2 py-2 pl-3 pr-9 bg-gray-800 rounded-full">
            <CursorSelection sizeClassName="w-6 h-6" />
            <p className="caption text-gray-500">
              Select code to annotate before sharing
            </p>
            <ClearButton onClick={() => setHintShown(false)} />
          </div>
        )}
        <CodeFull
          code={result?.code || ''}
          containerWidth={window.innerWidth * 0.6}
          containerHeight={window.innerHeight - 64 * 2}
          language={'javascript'}
          repoPath={result?.repoPath || ''}
          relativePath={result?.relativePath || ''}
          repoName={'bloop'}
          metadata={{
            hoverableRanges: [],
            lexicalBlocks: [],
          }}
          scrollElement={null}
        />
      </div>
    </ModalOrSidebar>
  );
};

export default ShareFileModal;
