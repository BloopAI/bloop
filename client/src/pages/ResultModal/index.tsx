import React, {
  MouseEvent,
  useEffect,
  useMemo,
  useState,
  useContext,
} from 'react';
import { useNavigate } from 'react-router-dom';
import FileIcon from '../../components/FileIcon';
import {
  ChevronDoubleIntersected,
  CloseSign,
  Modal,
  MoreHorizontal,
  Sidebar,
} from '../../icons';
import Button from '../../components/Button';
import SelectToggleButton from '../../components/SelectToggleButton';
import Tabs from '../../components/Tabs';
import CodeFull from '../../components/CodeBlock/CodeFull';
import { FullResult } from '../../types/results';
import CommitHistory from '../../components/CommitHistory';
import Dropdown from '../../components/Dropdown/Normal';
import ContributionsChart from '../../components/ContributionsChart';
import UserContributionsChart from '../../components/UserContributionsChart';
import { mockCommits, mockGitBlame } from '../../mocks';
import { FullResultModeEnum, MenuItemType } from '../../types/general';
import ModalOrSidebar from '../../components/ModalOrSidebar';
import ShareFileModal from '../../components/ShareFileModal';
import BreadcrumbsPath from '../../components/BreadcrumbsPath';
import {
  getFileManagerName,
  isWindowsPath,
  splitPath,
  splitPathForBreadcrumbs,
} from '../../utils';
import { DropdownWithIcon } from '../../components/Dropdown';
import { DeviceContext } from '../../context/deviceContext';
import useAppNavigation from '../../hooks/useAppNavigation';

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
  const { os, openFolderInExplorer, openLink } = useContext(DeviceContext);
  const { navigateFullResult } = useAppNavigation();

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

  const handleClose = (e: MouseEvent) => {
    onResultClosed();
  };

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
        return (
          <div
            className={`flex px-2 py-4 bg-gray-900 h-[calc(100vh-15rem)] overflow-y-auto p-3 pr-12`}
          >
            <div className="flex flex-col gap-5 w-full">
              <div className="flex flex-row justify-between items-center pt-4">
                <span className="flex flex-col">
                  <span className="text-lg">Jan 8,2017 - Oct 19,2020</span>
                  <span className="text-sm text-gray-500">
                    View the contributions to this file from the moment it was
                    created
                  </span>
                </span>
                <Dropdown
                  items={[
                    { text: 'Commits', type: MenuItemType.LINK },
                    { text: 'Additions', type: MenuItemType.LINK },
                    { text: 'Deletions', type: MenuItemType.LINK },
                  ]}
                  btnHint="Contributions:"
                />
              </div>
              <ContributionsChart variant="green" border />
              <div className="flex flex-row gap-5 justify-between">
                <UserContributionsChart
                  userImage={'/avatar.png'}
                  name={'John Doe'}
                  commits={2234}
                  additions={2211}
                  deletions={3321}
                />
                <UserContributionsChart
                  userImage={'avatar.png'}
                  name={'John Doe'}
                  commits={1731}
                  additions={2214}
                  deletions={4412}
                />
              </div>
            </div>
          </div>
        );
    }
  };

  return (
    <>
      <ModalOrSidebar
        isModalSidebarTransition={isModalSidebarTransition}
        setIsModalSidebarTransition={setIsModalSidebarTransition}
        isSidebar={mode === FullResultModeEnum.SIDEBAR}
        shouldShow={!!result}
        onClose={handleClose}
        containerClassName="w-[60vw]"
        filtersOverlay={mode === FullResultModeEnum.SIDEBAR}
      >
        <div className="flex justify-between items-center p-3 bg-gray-800 border-b border-gray-700 shadow-lighter select-none">
          <div className="flex gap-2">
            <SelectToggleButton
              onlyIcon
              onClick={() =>
                navigateFullResult(result.repoName, result.relativePath)
              }
              selected={false}
              title="Open in full view"
            >
              <ChevronDoubleIntersected />
            </SelectToggleButton>
            <SelectToggleButton
              onlyIcon
              onClick={() => setModeAndTransition(FullResultModeEnum.MODAL)}
              selected={mode === FullResultModeEnum.MODAL}
              title="Open in modal"
            >
              <Modal />
            </SelectToggleButton>
            <SelectToggleButton
              onlyIcon
              onClick={() => setModeAndTransition(FullResultModeEnum.SIDEBAR)}
              selected={mode === FullResultModeEnum.SIDEBAR}
              title="Open in sidebar"
            >
              <Sidebar />
            </SelectToggleButton>
          </div>
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
              onClick={handleClose}
              title="Close"
            >
              <CloseSign />
            </Button>
          </div>
        </div>
        <div className="w-full flex flex-col overflow-y-auto">
          <div className={`w-full border-b border-gray-700 p-3`}>
            <div className="flex items-center gap-2 max-w-full select-none justify-between">
              <div className="flex items-center gap-1 max-w-[calc(100%-40px)]">
                <FileIcon filename={result.relativePath.slice(-5)} />
                <div className="max-w-[calc(100%-20px)]">
                  <BreadcrumbsPath
                    repo={result.repoName}
                    path={result.relativePath}
                    activeStyle="secondary"
                    onClick={onResultClosed}
                  />
                </div>
              </div>
              {result?.repoPath.startsWith('local') && (
                <span className="flex-shrink-0">
                  <DropdownWithIcon
                    items={[
                      {
                        type: MenuItemType.DEFAULT,
                        text: `View in ${getFileManagerName(os.type)}`,
                        onClick: () => {
                          openFolderInExplorer(
                            result.repoPath.slice(6) +
                              (isWindowsPath(result.repoPath) ? '\\' : '/') +
                              (os.type === 'Darwin'
                                ? result.relativePath
                                : splitPath(result.relativePath)
                                    .slice(0, -1)
                                    .join(
                                      isWindowsPath(result.relativePath)
                                        ? '\\'
                                        : '/',
                                    )),
                          );
                        },
                      },
                    ]}
                    btnOnlyIcon
                    icon={<MoreHorizontal />}
                    noChevron
                    btnSize="small"
                  />
                </span>
              )}
            </div>
          </div>
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
