import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import * as Sentry from '@sentry/react';
import FileIcon from '../../components/FileIcon';
import Breadcrumbs from '../../components/Breadcrumbs';
import Tabs from '../../components/Tabs';
import NavBar from '../../components/NavBar';
import StatusBar from '../../components/StatusBar';
import IdeNavigation from '../../components/IdeNavigation';
import CodeFull from '../../components/CodeBlock/CodeFull';
import { getHoverables } from '../../services/api';
import { mapRanges } from '../../mappers/results';
import ShareFileModal from '../../components/ShareFileModal';
import { useSearch } from '../../hooks/useSearch';
import { SearchResponseFileItems } from '../../types/api';
import { FullResult } from '../../types/results';
import { splitPathForBreadcrumbs } from '../../utils';
import ErrorFallback from '../../components/ErrorFallback';

type Props = {};

const mockRepo = {
  name: 'cobra-ats',
  files: [
    { name: '.editorconfig' },
    { name: '.gitignore' },
    {
      name: 'styles',
      children: [
        { name: 'base.css' },
        { name: 'navbar.css' },
        { name: 'buttons.css' },
      ],
    },
    {
      name: 'src',
      children: [
        { name: 'app.js' },
        { name: 'function.js' },
        { name: 'router.js' },
      ],
    },
    {
      name: 'public',
      children: [{ name: 'index.html' }, { name: 'favicon.ico' }],
    },
  ],
  branches: [
    { title: 'mainroute' },
    { title: 'base/test/browser/formatted_transitions' },
    { title: 'testroute' },
  ],
  versions: [{ title: '2.6' }, { title: '2.3' }],
};

const tabs = [
  { title: 'Code' },
  // { title: 'Owners' },
  // { title: 'Something Else' },
];

const mainContainerStyle = { height: 'calc(100vh - 8rem)' };

const ViewResult = () => {
  const [activeTab, setActiveTab] = useState(0);
  const [isShareOpen, setShareOpen] = useState(false);
  const [scrollableElement, setScrollableElement] =
    useState<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [result, setResult] = useState<FullResult | null>(null);
  const filePath = useMemo(
    () => searchParams.get('relativePath'),
    [searchParams],
  );
  const repoPath = useMemo(() => searchParams.get('repoPath'), [searchParams]);
  const repoName = useMemo(() => searchParams.get('repoName'), [searchParams]);
  const { data, searchQuery } = useSearch<SearchResponseFileItems>();
  useEffect(() => {
    if (filePath) {
      searchQuery(`open:true repo:${repoName} path:${filePath}`);
    }
  }, [filePath]);

  useEffect(() => {
    if (!data) {
      return;
    }

    getHoverables(filePath!, repoPath!).then((hData) => {
      setResult({
        relativePath: filePath!,
        repoPath: repoPath!,
        code: data.data[0].data.contents,
        hoverableRanges: mapRanges(hData?.ranges || []),
        language: data.data[0].data.lang,
        repoName: repoName!,
      });
    });
  }, [data]);

  const breadcrumbs = useMemo(
    () => (result ? splitPathForBreadcrumbs(result.relativePath) : []),
    [result?.relativePath],
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setScrollableElement(scrollRef.current);
  });

  return (
    <div className="text-gray-200">
      <NavBar userSigned />
      <div
        className="flex mt-16 w-screen overflow-hidden relative"
        style={mainContainerStyle}
      >
        <IdeNavigation
          repoName={mockRepo.name}
          files={mockRepo.files}
          branches={mockRepo.branches}
          versions={mockRepo.versions}
          onBackNavigate={() => navigate('/')}
          initialBranch={0}
          initialVersion={0}
        />
        {!!result && (
          <div className="flex-1 overflow-auto w-full box-content flex flex-col">
            <div className="w-full flex flex-col overflow-auto flex-1">
              <div
                className={`w-full border-b border-gray-700 flex justify-between py-3 px-8 select-none`}
              >
                <div className="flex items-center gap-1 overflow-hidden">
                  <FileIcon filename={result.relativePath.slice(-5)} />
                  <Breadcrumbs
                    pathParts={breadcrumbs}
                    activeStyle="secondary"
                    path={filePath!}
                  />
                </div>
                <div className="flex gap-2">
                  {/*<SelectToggleButton onlyIcon title="Star">*/}
                  {/*  <Star />*/}
                  {/*</SelectToggleButton>*/}
                  {/*<Button variant="primary" onClick={() => setShareOpen(true)}>*/}
                  {/*  Share*/}
                  {/*  <ArrowBoxOut />*/}
                  {/*</Button>*/}
                </div>
              </div>
              <div className="overflow-scroll flex-1" ref={scrollRef}>
                <div
                  className={`border-b border-gray-700 w-full pb-0 py-3 px-8`}
                >
                  <Tabs
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    tabs={tabs}
                  />
                </div>
                {activeTab === 0 ? (
                  <div
                    className={`flex px-2 py-4 bg-gray-900 py-3 px-8 h-full`}
                  >
                    <CodeFull
                      code={result.code}
                      language={'javascript'}
                      repoPath={result.repoPath}
                      relativePath={result.relativePath}
                      metadata={{
                        hoverableRanges: [],
                        lexicalBlocks: [],
                      }}
                      scrollElement={scrollableElement}
                      repoName={repoName!}
                    />
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </div>
      <ShareFileModal
        isOpen={isShareOpen}
        onClose={() => setShareOpen(false)}
        result={result}
        filePath={filePath}
        breadcrumbs={breadcrumbs}
      />
      <StatusBar />
    </div>
  );
};

export default Sentry.withErrorBoundary(ViewResult, {
  fallback: (props) => <ErrorFallback {...props} />,
});
