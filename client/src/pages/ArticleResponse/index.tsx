import { useContext, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { conversationsCache } from '../../services/cache';
import { ChatMessageServer } from '../../types/general';
import { ChatContext } from '../../context/chatContext';
import { FileModalContext } from '../../context/fileModalContext';
import FileChip from '../../components/Chat/ConversationMessage/FileChip';
import NewCode from '../ConversationResult/NewCode';

type Props = {
  recordId: number;
  threadId: string;
};

const ArticleResponse = ({ recordId, threadId }: Props) => {
  const { conversation } = useContext(ChatContext);
  const { openFileModal } = useContext(FileModalContext);
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
    <div className="p-8 flex-1 overflow-x-auto mx-auto max-w-3xl box-content article-response body-m text-label-base pb-44">
      <ReactMarkdown
        components={{
          a(props) {
            const [filePath, lines] = props.href?.split('#') || [];
            const [start, end] = lines?.split('-').map((l) => l.slice(1)) || [];
            return (
              <FileChip
                fileName={filePath || ''}
                onClick={() =>
                  openFileModal(filePath, start ? `${start}_${end}` : undefined)
                }
              />
            );
          },
          code({ node, inline, className, children, ...props }) {
            const matchLang = /language-(\w+)/.exec(className || '');
            const matchPath = /path:(.+),/.exec(className || '');
            const matchLines = /lines:(.+)/.exec(className || '');
            return !inline &&
              matchLang?.[1] &&
              typeof children[0] === 'string' ? (
              <NewCode
                code={`${
                  matchPath?.[1]
                    ? `// ${matchPath[1]}${
                        matchLines?.[1]
                          ? `:${matchLines?.[1]
                              .split('-')
                              .map((l) => l.slice(1))
                              .join(':')}
`
                          : ''
                      }`
                    : ''
                }${children[0].replace(/\n$/, '')}`}
                language={matchLang[1]}
              />
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
  );
};

export default ArticleResponse;
