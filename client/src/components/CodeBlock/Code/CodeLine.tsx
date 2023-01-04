import React, { ReactNode, useEffect, useMemo, useState } from 'react';
import { format } from 'timeago.js';
import FoldButton from '../CodeFull/FoldButton';
import Tooltip from '../../Tooltip';
import SymbolIcon from '../../CodeSymbolIcon';
import { SymbolType } from '../../../types/results';
import { Commit } from '../../../types';
import TooltipCommit from '../../TooltipCommit';

type Props = {
  lineNumber: number;
  children: ReactNode;
  showLineNumbers?: boolean;
  lineFoldable?: boolean;
  handleFold?: (state: boolean, line: number) => void;
  lineHidden?: boolean;
  symbols?: SymbolType[];
  hoverEffect?: boolean;
  blame?: boolean;
  blameLine?: {
    start: boolean;
    commit?: Commit;
  };
  stylesGenerated?: any;
  shouldHighlight?: boolean;
};

const CodeLine = ({
  lineNumber,
  showLineNumbers,
  children,
  lineFoldable,
  handleFold,
  lineHidden,
  blame,
  blameLine,
  symbols,
  hoverEffect,
  stylesGenerated,
  shouldHighlight,
}: Props) => {
  const [isHighlighted, setHighlighted] = useState(false);

  useEffect(() => {
    if (shouldHighlight) {
      setHighlighted(true);
      setTimeout(() => setHighlighted(false), 2000);
    }
  }, [shouldHighlight]);

  const blameStyle = useMemo(() => {
    if (blameLine?.start) {
      return '';
    } else if (blameLine?.start === false) {
      return 'p-0 pb-1 align-top';
    }
    return '';
  }, [blameLine?.start]);

  const renderBlameLine = useMemo(() => {
    if (blame) {
      if (blameLine?.commit && blameLine?.start) {
        return (
          <td className="p-0 pt-1 pl-2">
            <span className="flex flex-row items-center gap-2">
              <TooltipCommit
                position={'left'}
                image={blameLine.commit.image!}
                name={blameLine.commit.author}
                message={blameLine.commit.message}
                date={blameLine.commit.datetime}
                showOnClick
              >
                <img
                  className="w-5 rounded-xl cursor-pointer select-none"
                  src="/avatar.png"
                  alt=""
                />
              </TooltipCommit>
              <span className="text-gray-500 caption">
                {format(blameLine.commit.datetime)}
              </span>
            </span>
          </td>
        );
      }
    }
    return <td className={`p-0 ${blameStyle}`}></td>;
  }, [blame, blameLine]);

  const style = useMemo(
    () => ({ lineHeight: lineHidden ? '0' : '', ...stylesGenerated }),
    [lineHidden, stylesGenerated],
  );
  const [actualLineNumber] = useState(lineNumber);

  return (
    <tr
      className={`transition-all duration-150 ease-in-bounce group hover:bg-transparent ${
        lineHidden ? 'opacity-0' : ''
      } ${
        blameLine?.start && lineNumber !== 0 ? ' border-t border-gray-700' : ''
      }`}
      style={style}
    >
      {renderBlameLine}
      {symbols?.length ? (
        <td
          className={`peer text-center text-purple ${lineHidden ? 'p-0' : ''}`}
        >
          <span className="flex flex-row gap-1">
            {symbols.length > 1 ? (
              <Tooltip
                text={
                  <div>
                    {symbols.map((symbol, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <SymbolIcon type={symbol} />
                        <span className="caption text-gray-200 py-1">
                          {symbol.charAt(0).toUpperCase()}
                          {symbol.slice(1)}
                        </span>
                      </div>
                    ))}
                  </div>
                }
                placement="top"
              >
                <SymbolIcon type="multiple" />
              </Tooltip>
            ) : (
              <Tooltip text={symbols[0]} placement="top">
                <SymbolIcon type={symbols[0]} />
              </Tooltip>
            )}
          </span>
        </td>
      ) : (
        <td className={`px-1 text-center ${lineHidden ? 'p-0' : ''}`} />
      )}
      {showLineNumbers && (
        <td
          data-line={lineNumber + 1}
          className={`text-gray-500 min-w-6 text-right select-none pr-0 leading-5 ${blameStyle} ${
            lineHidden ? 'p-0' : ''
          } ${hoverEffect ? 'group-hover:text-gray-300' : ''}
           ${lineHidden ? '' : 'before:content-[attr(data-line)]'}
          `}
        ></td>
      )}
      <td className={`text-gray-500 ${lineHidden ? 'p-0' : ''} ${blameStyle}`}>
        {lineFoldable && (
          <FoldButton
            onClick={(folded: boolean) => {
              if (handleFold) {
                handleFold(!folded, actualLineNumber);
              }
            }}
          />
        )}
      </td>
      <td
        className={`pl-2 ${lineHidden ? 'p-0' : ''} ${
          isHighlighted ? 'animate-flash-highlight rounded-4 pr-2' : ''
        }`}
      >
        {children}
      </td>
      <td>
        <br />
      </td>
    </tr>
  );
};
export default CodeLine;
