import React, { memo, useCallback, useContext, useMemo } from 'react';
import { Remarkable } from 'remarkable';
import { highlightCode } from '../../../utils/prism';
import { DeviceContext } from '../../../context/deviceContext';

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

type Props = {
  text: string;
  baseUrl: string;
  isEditingSelection: boolean;
};

const RenderedSection = ({ text, baseUrl, isEditingSelection }: Props) => {
  const { openLink } = useContext(DeviceContext);

  const markdown = useMemo(() => md.render(text), [text]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // @ts-ignore
      const href = e.target.getAttribute('href');
      if (href) {
        e.preventDefault();
        e.stopPropagation();
        openLink(
          href.startsWith('http://') || href.startsWith('https://')
            ? href
            : new URL(href, baseUrl).href,
        );
      }
    },
    [openLink, baseUrl],
  );

  return (
    <div
      className={`body-s doc-section ${
        isEditingSelection ? 'cursor-pointer' : ''
      }`}
    >
      <div
        dangerouslySetInnerHTML={{ __html: markdown }}
        onClick={handleClick}
      />
    </div>
  );
};

export default memo(RenderedSection);
