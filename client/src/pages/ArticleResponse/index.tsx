import { useContext, useEffect, useMemo, useRef } from 'react';
import { Remarkable } from 'remarkable';
import { conversationsCache } from '../../services/cache';
import { ChatMessageServer } from '../../types/general';
import { ChatContext } from '../../context/chatContext';
import { highlightCode } from '../../utils/prism';
import { findAllElementsInCurrentTab } from '../../utils/domUtils';
import { FileModalContext } from '../../context/fileModalContext';

type Props = {
  recordId: number;
  threadId: string;
};

const md = new Remarkable({
  html: false,
  highlight(str: string, lang: string): string {
    try {
      return highlightCode(str, lang);
    } catch (err) {
      console.log(err);
      return '';
    }
  },
  linkTarget: '__blank',
});

const ArticleResponse = ({ recordId, threadId }: Props) => {
  const { conversation } = useContext(ChatContext);
  const { openFileModal } = useContext(FileModalContext);
  const ref = useRef<HTMLDivElement>(null);
  const data = useMemo(
    () =>
      (conversationsCache[threadId]?.[recordId] || conversation[recordId])
        ?.text,
    [(conversation[recordId] as ChatMessageServer)?.text, recordId, threadId],
  );

  const content = useMemo(() => {
    return md.render(data);
  }, [data]);

  useEffect(() => {
    const links = findAllElementsInCurrentTab<HTMLAnchorElement>(
      '.article-response a',
    );
    const handlers: (() => void)[] = [];
    if (links?.length) {
      Array.from(links).forEach((link, i) => {
        const [filePath, lines] = link.getAttribute('href')?.split('#') || '';
        const [start, end] = lines.split('-').map((l) => l.slice(1));
        handlers.push(() => openFileModal(filePath, `${start}_${end}`));
        link.addEventListener('click', handlers[i]);
      });
    }
    return () => {
      if (links?.length) {
        Array.from(links).forEach((link, i) => {
          link.removeEventListener('click', handlers[i]);
        });
      }
    };
  }, [content]);

  return (
    <div className="p-8 flex-1 overflow-x-auto mx-auto max-w-6.5xl box-content article-response">
      <div dangerouslySetInnerHTML={{ __html: content }} ref={ref} />
    </div>
  );
};

export default ArticleResponse;
