import React, {
  Dispatch,
  memo,
  SetStateAction,
  useCallback,
  useContext,
  useMemo,
} from 'react';
import { Remarkable } from 'remarkable';
import { highlightCode } from '../../../utils/prism';
import { DeviceContext } from '../../../context/deviceContext';
import Checkbox from '../../../components/Checkbox';

const md = new Remarkable({
  html: true,
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
  isSelected: boolean;
  setSelected: Dispatch<SetStateAction<boolean>>;
};

const DocSection = ({ text, isSelected, setSelected }: Props) => {
  const { openLink } = useContext(DeviceContext);

  const markdown = useMemo(() => md.render(text), [text]);

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      // @ts-ignore
      const { href } = e.target;
      if (href) {
        e.preventDefault();
        openLink(href);
      }
    },
    [openLink],
  );

  return (
    <div
      className={`body-s ${
        isSelected
          ? 'bg-bg-main/15 opacity-100'
          : 'opacity-50 hover:opacity-100'
      } pl-8 pr-4 py-3 transition-opacity duration-150 ease-in-out flex items-start gap-5`}
    >
      <Checkbox
        checked={isSelected}
        label={
          <div className="body-s overflow-x-auto doc-section">
            <div
              dangerouslySetInnerHTML={{ __html: markdown }}
              onClick={handleClick}
            />
          </div>
        }
        isBoxAtTop
        boxClassName="relative top-1"
        onChange={setSelected}
      />
    </div>
  );
};

export default memo(DocSection);
