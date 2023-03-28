import React, { useEffect, useMemo, useState } from 'react';
import { CloseSign } from '../../icons';
import Button from '../../components/Button';
import CodeFull from '../../components/CodeBlock/CodeFull';
import { FullResult } from '../../types/results';
import CommitHistory from '../../components/CommitHistory';
import { mockCommits, mockGitBlame } from '../../mocks';
import { FullResultModeEnum } from '../../types/general';
import ModalOrSidebar from '../../components/ModalOrSidebar';
import ShareFileModal from '../../components/ShareFileModal';
import { splitPathForBreadcrumbs } from '../../utils';
import Contributors from '../../components/Contributors';
import ModeToggle from './ModeToggle';
import Subheader from './Subheader';

type Props = {
  result: FullResult;
  onResultClosed: () => void;
  mode: FullResultModeEnum;
  setMode: (n: FullResultModeEnum) => void;
};

/*
const tabs = [
  { title: 'Code' },
  { title: 'Blame' },
  { title: 'Commits' },
  { title: 'Authors' },
];
*/

const ResultModal = ({ result, onResultClosed, mode, setMode }: Props) => {
  const [activeTab, setActiveTab] = useState(0);
  const [isShareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    const action =
      !!result && mode === FullResultModeEnum.MODAL ? 'add' : 'remove';
    document.body.classList[action]('overflow-hidden');
  }, [result, mode]);

  // By tracking if animation is between sidebar and modal, rather than entry and exit, we can vary the transition
  const [isModalSidebarTransition, setIsModalSidebarTransition] =
    useState(false);
  const setModeAndTransition = (newMode: FullResultModeEnum) => {
    setIsModalSidebarTransition(true);
    setMode(newMode);
  };

  const breadcrumbs = useMemo(
    () => (result ? splitPathForBreadcrumbs(result.relativePath) : []),
    [result?.relativePath],
  );

  const metadata = useMemo(
    () => ({
      lexicalBlocks: [],
      hoverableRanges: result?.hoverableRanges || [],
    }),
    [result?.hoverableRanges],
  );

  const getContent = (result: FullResult) => {
    switch (activeTab) {
      case 0:
      default:
        return (
          <div
            className={`flex px-2 py-4 bg-gray-900 h-[calc(100vh-15rem)] overflow-y-auto p-3 pr-12`}
          >
            <CodeFull
              code={result.code}
              language={result.language}
              relativePath={result.relativePath}
              repoPath={result.repoPath}
              repoName={result.repoName}
              metadata={metadata}
              scrollElement={null}
              containerWidth={window.innerWidth * 0.6}
              containerHeight={window.innerHeight - 15 * 16 - 32}
            />
          </div>
        );
      case 1:
        return (
          <div
            className={`flex bg-gray-900 h-[calc(100vh-15rem)] overflow-y-auto`}
          >
            <CodeFull
              code={result.code}
              language={result.language}
              relativePath={result.relativePath}
              repoPath={result.repoPath}
              repoName={result.repoName}
              metadata={{
                lexicalBlocks: [],
                hoverableRanges: [],
                blame: mockGitBlame,
              }}
              scrollElement={null}
              containerWidth={window.innerWidth * 0.6}
              containerHeight={window.innerHeight - 15 * 16}
            />
          </div>
        );
      case 2:
        return (
          <div
            className={`flex bg-gray-900 h-[calc(100vh-15rem)] overflow-y-auto pl-3 pr-12`}
          >
            <CommitHistory commits={mockCommits} showFirstSeparator={false} />
          </div>
        );
      case 3:
        return <Contributors />;
    }
  };

  return (
    <>
      <ModalOrSidebar
        isModalSidebarTransition={isModalSidebarTransition}
        setIsModalSidebarTransition={setIsModalSidebarTransition}
        isSidebar={mode === FullResultModeEnum.SIDEBAR}
        shouldShow={!!result}
        onClose={onResultClosed}
        containerClassName="w-[60vw]"
        filtersOverlay={mode === FullResultModeEnum.SIDEBAR}
      >
        <div className="flex justify-between items-center p-3 bg-gray-800 border-b border-gray-700 shadow-lighter select-none">
          <ModeToggle
            repoName={result.repoName}
            relativePath={result.relativePath}
            mode={mode}
            setModeAndTransition={setModeAndTransition}
          />
          <div className="flex gap-2">
            {/*<SelectToggleButton onlyIcon title="Star">*/}
            {/*  <Star />*/}
            {/*</SelectToggleButton>*/}
            {/*<Button variant="primary" onClick={() => setShareOpen(true)}>*/}
            {/*  Share*/}
            {/*  <ArrowBoxOut />*/}
            {/*</Button>*/}
            <Button
              onlyIcon
              variant="tertiary"
              onClick={onResultClosed}
              title="Close"
            >
              <CloseSign />
            </Button>
          </div>
        </div>
        <div className="w-full flex flex-col overflow-y-auto">
          <Subheader
            relativePath={result.relativePath}
            repoName={result.repoName}
            repoPath={result.repoPath}
            onResultClosed={onResultClosed}
          />
          {/*<div className={`border-b border-gray-700 w-full pb-0 p-3`}>*/}
          {/*  <Tabs*/}
          {/*    activeTab={activeTab}*/}
          {/*    onTabChange={setActiveTab}*/}
          {/*    tabs={tabs}*/}
          {/*  />*/}
          {/*</div>*/}
          <div
            className={`flex px-2 py-4 bg-gray-900 h-[calc(100vh-15rem)] overflow-y-auto p-3 pr-12`}
          >
            <CodeFull
              code={result.code}
              language={result.language}
              relativePath={result.relativePath}
              repoPath={result.repoPath}
              repoName={result.repoName}
              metadata={metadata}
              scrollElement={null}
              containerWidth={window.innerWidth * 0.6 - 56}
              containerHeight={window.innerHeight - 15 * 16 - 32}
            />
          </div>
        </div>
      </ModalOrSidebar>
      <ShareFileModal
        isOpen={isShareOpen}
        onClose={() => setShareOpen(false)}
        result={result}
        breadcrumbs={breadcrumbs}
        filePath={result?.relativePath || ''}
      />
    </>
  );
};

export default ResultModal;
