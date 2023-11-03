import React, { memo, useCallback, useContext, useMemo } from 'react';
import { Remarkable } from 'remarkable';
import { highlightCode } from '../../../../utils/prism';
import { DeviceContext } from '../../../../context/deviceContext';

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
};

const RenderedSection = ({ text }: Props) => {
  const { openLink } = useContext(DeviceContext);

  const markdown = useMemo(() => md.render(text), [text]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // @ts-ignore
      const { href } = e.target;
      if (href) {
        e.preventDefault();
        e.stopPropagation();
        openLink(href);
      }
    },
    [openLink],
  );

  return (
    <div className="body-s doc-section">
      <div
        dangerouslySetInnerHTML={{ __html: markdown }}
        onClick={handleClick}
      />
    </div>
  );
};

export default memo(RenderedSection);
