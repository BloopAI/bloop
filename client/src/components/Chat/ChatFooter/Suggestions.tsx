import { Fragment, memo, useCallback, useMemo, useState } from 'react';
import useKeyboardNavigation from '../../../hooks/useKeyboardNavigation';
import SuggestionItem from './SuggestionItem';

type Props = {
  pathOptions: string[];
  langOptions: string[];
  dirOptions: string[];
  onSubmit: (o: { type: string; text: string }) => void;
};

const sections = [
  { label: 'Files', key: 'pathOptions', type: 'path' },
  { label: 'Folders', key: 'dirOptions', type: 'path' },
  { label: 'Languages', key: 'langOptions', type: 'lang' },
];

const Suggestions = (props: Props) => {
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const optionsToShow = useMemo(() => {
    const result: { label: string; key: string; type: string; text: string }[] =
      [];

    sections.forEach((s) => {
      // @ts-ignore
      props[s.key].forEach((o) => {
        result.push({ text: o, ...s });
      });
    });
    return result;
  }, [props]);

  const handleKeyEvent = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        props.onSubmit(optionsToShow[highlightedIndex]);
      } else {
        if (e.key === 'ArrowDown') {
          setHighlightedIndex((prev) =>
            prev < optionsToShow.length - 1 ? prev + 1 : 0,
          );
        } else if (e.key === 'ArrowUp') {
          setHighlightedIndex((prev) =>
            prev > 0 ? prev - 1 : optionsToShow.length - 1,
          );
        }
      }
    },
    [optionsToShow, highlightedIndex, props.onSubmit],
  );
  useKeyboardNavigation(handleKeyEvent);

  return (
    <div className="absolute bottom-20 left-4 select-none">
      <div className="rounded-md border border-chat-bg-border bg-chat-bg-shade shadow-high flex flex-col p-1 max-h-64 overflow-auto">
        {optionsToShow.map((s, i) => (
          <Fragment key={s.text + s.key + i}>
            {s.key !== optionsToShow[i - 1]?.key && (
              <div className="flex items-center rounded-6 gap-2 px-2 py-1 text-label-muted caption cursor-default">
                {s.label}
              </div>
            )}
            <SuggestionItem
              text={s.text}
              kind={s.key}
              type={s.type}
              isFocused={highlightedIndex === i}
              onClick={props.onSubmit}
              setHighlightedIndex={setHighlightedIndex}
              i={i}
            />
          </Fragment>
        ))}
      </div>
    </div>
  );
};

export default memo(Suggestions);
