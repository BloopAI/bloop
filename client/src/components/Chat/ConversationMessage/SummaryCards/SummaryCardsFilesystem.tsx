import React, { useContext } from 'react';
import { AppNavigationContext } from '../../../../context/appNavigationContext';
import {
  MessageResultCite,
  MessageResultDirectory,
  MessageResultModify,
  MessageResultNew,
} from '../../../../types/general';
import SummaryCardMain from './SummaryCardMain';
import SummaryCardSecondary from './SummaryCardSecondary';
import CodeSummary from './CodeSummary';
import NewCodeSummary from './NewCodeSummary';
import DirectorySummary from './DirectorySummary';

type Props = {
  results: (
    | MessageResultCite
    | MessageResultNew
    | MessageResultModify
    | MessageResultDirectory
  )[];
  i: number;
  threadId: string;
  repoName: string;
};

const SummaryCardsFilesystem = ({ results, i, threadId, repoName }: Props) => {
  const { navigateConversationResults } = useContext(AppNavigationContext);
  return (
    <>
      {results
        .slice(0, 3)
        .reverse()
        .map((p, index, array) => {
          let child = (isMain: boolean) => {
            if ('New' in p) {
              return (
                <NewCodeSummary code={p.New.code} language={p.New.language} />
              );
            }
            if ('Cite' in p || 'Modify' in p) {
              const data = 'Cite' in p ? p.Cite : p.Modify;
              return (
                <CodeSummary
                  path={data.path}
                  isMain={isMain}
                  repoName={repoName}
                  startLine={
                    'Cite' in p
                      ? p.Cite.start_line
                      : p.Modify.diff.header.old_start
                  }
                />
              );
            }
            if ('Directory' in p) {
              return (
                <DirectorySummary path={p.Directory.path} repoName={repoName} />
              );
            }
            return null;
          };
          return index === array.length - 1 ? (
            <SummaryCardMain
              onClick={() => navigateConversationResults(i, threadId)}
              key={index}
              isArticle={false}
            >
              {child(true)}
            </SummaryCardMain>
          ) : (
            <SummaryCardSecondary
              isMiddle={index === 0 || array.length === 2}
              key={index}
              isArticle={false}
            >
              {child(false)}
            </SummaryCardSecondary>
          );
        })}
    </>
  );
};

export default SummaryCardsFilesystem;
