import { useContext, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { conversationsCache } from '../../services/cache';
import { ChatMessageServer } from '../../types/general';
import { ChatContext } from '../../context/chatContext';
import { FileModalContext } from '../../context/fileModalContext';
import FileChip from '../../components/Chat/ConversationMessage/FileChip';
import NewCode from '../ConversationResult/NewCode';
import { UIContext } from '../../context/uiContext';
import CodeWithBreadcrumbs from './CodeWithBreadcrumbs';

type Props = {
  recordId: number;
  threadId: string;
};

const ArticleResponse = ({ recordId, threadId }: Props) => {
  const { conversation } = useContext(ChatContext);
  const { openFileModal } = useContext(FileModalContext);
  const { tab } = useContext(UIContext);
  const data = useMemo(
    () => conversationsCache[threadId]?.[recordId] || conversation[recordId],
    [
      (conversation[recordId] as ChatMessageServer)?.results,
      (conversation[recordId] as ChatMessageServer)?.isLoading,
      recordId,
      threadId,
    ],
  );

  return (
    <div className="overflow-auto p-8 w-screen">
      <div className="flex-1 mx-auto max-w-3xl box-content article-response body-m text-label-base pb-44 break-word">
        <ReactMarkdown
          components={{
            a(props) {
              const [filePath, lines] = props.href?.split('#') || [];
              const [start, end] =
                lines?.split('-').map((l) => l.slice(1)) || [];
              return (
                <FileChip
                  fileName={filePath || ''}
                  onClick={() =>
                    openFileModal(
                      filePath,
                      start ? `${start}_${end}` : undefined,
                    )
                  }
                />
              );
            },
            code({ node, inline, className, children, ...props }) {
              const matchLang = /language-(\w+)/.exec(className || '');
              const matchPath = /path:(.+),/.exec(className || '');
              const matchLines = /lines:(.+)/.exec(className || '');
              const code =
                typeof children[0] === 'string'
                  ? children[0].replace(/\n$/, '')
                  : '';
              const lines =
                matchLines?.[1].split('-').map((l) => Number(l.slice(1))) || [];
              return !inline &&
                matchLang?.[1] &&
                typeof children[0] === 'string' ? (
                matchPath?.[1] ? (
                  <CodeWithBreadcrumbs
                    code={code}
                    language={matchLang[1]}
                    filePath={matchPath[1]}
                    onResultClick={() =>
                      openFileModal(
                        matchPath[1],
                        lines[0]
                          ? `${lines[0]}_${
                              lines[0] + code.split('\n').length - 1
                            }`
                          : undefined,
                      )
                    }
                    endLine={lines[1]}
                    startLine={lines[0]}
                    repoName={tab.repoName}
                  />
                ) : (
                  <NewCode code={code} language={matchLang[1]} />
                )
              ) : (
                <code {...props} className={className}>
                  {children}
                </code>
              );
            },
          }}
        >
          {data?.isLoading
            ? data?.results?.Article?.replace(
                /\[\`[^`]*$|\[\`[^`]+\`\]\([^)]*$/,
                '',
              )
            : data?.results?.Article}
        </ReactMarkdown>
      </div>
    </div>
  );
};

export default ArticleResponse;
