import {
  AnchorHTMLAttributes,
  DetailedHTMLProps,
  ReactElement,
  useContext,
  useMemo,
} from 'react';
import ReactMarkdown from 'react-markdown';
import { CodeProps } from 'react-markdown/lib/ast-to-react';
import { ReactMarkdownProps } from 'react-markdown/lib/complex-types';
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

  const components = useMemo(() => {
    return {
      a(
        props: Omit<
          DetailedHTMLProps<
            AnchorHTMLAttributes<HTMLAnchorElement>,
            HTMLAnchorElement
          >,
          'ref'
        > &
          ReactMarkdownProps,
      ) {
        const [filePath, lines] = props.href?.split('#') || [];
        const [start, end] =
          lines?.split('-').map((l) => Number(l.slice(1))) || [];
        let fileName: string = '';
        if (props.children?.[0]) {
          if (typeof props.children[0] === 'string') {
            fileName = props.children?.[0];
          }
          const child = props.children[0] as ReactElement;
          if (child?.props && typeof child.props.children?.[0] === 'string') {
            fileName = child.props.children?.[0];
          }
        }
        return (
          <FileChip
            fileName={fileName || filePath || ''}
            skipIcon={!!fileName && fileName !== filePath}
            onClick={() =>
              openFileModal(
                filePath,
                start ? `${start - 1}_${end - 1}` : undefined,
              )
            }
          />
        );
      },
      code({ node, inline, className, children, ...props }: CodeProps) {
        console.log('className', className);
        const matchLang = /language-(\w+)/.exec(className || '');
        const matchPath = /path:(.+),/.exec(className || '');
        const matchLines = /lines:(.+)/.exec(className || '');
        const code =
          typeof children[0] === 'string' ? children[0].replace(/\n$/, '') : '';
        const lines =
          matchLines?.[1].split('-').map((l) => Number(l.slice(1))) || [];
        return !inline && matchLang?.[1] && typeof children[0] === 'string' ? (
          matchPath?.[1] ? (
            <CodeWithBreadcrumbs
              code={code}
              language={matchLang[1]}
              filePath={matchPath[1]}
              onResultClick={openFileModal}
              startLine={lines[0] - 1}
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
    };
  }, [tab.repoName, openFileModal]);

  return (
    <div className="overflow-auto p-8 w-screen">
      <div className="flex-1 mx-auto max-w-3xl box-content article-response body-m text-label-base pb-44 break-word">
        <ReactMarkdown components={components}>
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
