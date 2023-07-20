import React, { useContext } from 'react';
import MarkdownWithCode from '../../../MarkdownWithCode';
import { AppNavigationContext } from '../../../../context/appNavigationContext';
import SummaryCardMain from './SummaryCardMain';
import SummaryCardSecondary from './SummaryCardSecondary';

type Props = {
  article: string;
  i: number;
  threadId: string;
};

const SummaryCardsArticle = ({ article, i, threadId }: Props) => {
  const { navigateArticleResponse } = useContext(AppNavigationContext);
  return (
    <>
      {article
        .split('\n\n')
        .slice(
          ...(article.startsWith('## ') || article.startsWith('# ')
            ? [1, 4]
            : [0, 3]),
        )
        .reverse()
        .map((p, index, array) =>
          index === array.length - 1 ? (
            <SummaryCardMain
              onClick={() => navigateArticleResponse(i, threadId)}
              key={index}
              isArticle
            >
              <MarkdownWithCode
                openFileModal={() => {}}
                repoName={''}
                markdown={p}
                isSummary
              />
            </SummaryCardMain>
          ) : (
            <SummaryCardSecondary
              isMiddle={index === 0 || array.length === 2}
              key={index}
              isArticle
            >
              <MarkdownWithCode
                openFileModal={() => {}}
                repoName={''}
                markdown={p}
                isSummary
              />
            </SummaryCardSecondary>
          ),
        )}
    </>
  );
};

export default SummaryCardsArticle;
