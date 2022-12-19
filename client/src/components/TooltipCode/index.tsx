import React, { useCallback, useMemo, useState } from 'react';
import Tippy, { TippyProps } from '@tippyjs/react/headless';
import Tabs from '../Tabs';
import Code from '../CodeBlock/Code';
import { TokenInfo, TokenInfoFile, TokenInfoItem } from '../../types/results';
import BreadcrumbsPath from '../BreadcrumbsPath';

type Props = {
  language: string;
  data: TokenInfo;
  position: 'left' | 'center' | 'right';
  children: React.ReactNode;
  onHover: () => void;
  repoName: string;
  onRefDefClick: (item: TokenInfoItem, filePath: string) => void;
};

const positionMapping = {
  left: '-start',
  right: '-end',
  center: '',
};

const positionMap = {
  left: { tail: 'left-1', fixBorder: 'left-[8.38px]' },
  center: {
    tail: 'left-1/2 -translate-x-1/2',
    fixBorder: 'left-[13px] left-1/2 -translate-x-1/2 transform',
  },
  right: { tail: 'right-2', fixBorder: 'right-[12.3px]' },
};

const tailStyles = {
  top: {
    tail: 'bg-gray-700 top-2',
    fixture: 'border-b-[1px] top-[10px]',
  },
  bottom: {
    tail: 'bg-gray-800 bottom-2',
    fixture: 'border-t-[1px] border-gray-800 bottom-[10px]',
  },
};

const TooltipCode = ({
  data,
  position,
  language,
  children,
  onHover,
  repoName,
  onRefDefClick,
}: Props) => {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = useMemo(() => {
    if (data.definitions?.length && data.references?.length) {
      return [{ title: 'References' }, { title: 'Definitions' }];
    }
    if (data.references?.length) {
      return [{ title: 'References' }];
    }
    if (data.definitions?.length) {
      return [{ title: 'Definitions' }];
    }
    return [];
  }, [data]);

  const countItems = useCallback((items: TokenInfoFile[]) => {
    return items.reduce((acc: number, item) => {
      return acc + item.items.length;
    }, 0);
  }, []);

  const getTailPosition = (
    placement: TippyProps['placement'],
  ): {
    horizontal: 'left' | 'center' | 'right';
    vertical: 'bottom' | 'top';
  } => {
    return {
      horizontal: placement?.endsWith('start')
        ? 'left'
        : placement?.endsWith('end')
        ? 'right'
        : 'center',
      vertical: placement?.startsWith('top') ? 'bottom' : 'top',
    };
  };

  const renderTooltip = (attrs: {
    'data-placement': TippyProps['placement'];
  }) => {
    if (!(data.definitions?.length || data.references?.length)) {
      return '';
    }
    const tailPosition = getTailPosition(attrs['data-placement']);

    return (
      <div className="relative py-[10px] w-fit" {...attrs}>
        <span
          className={`absolute ${
            positionMap[tailPosition.horizontal].tail
          } w-5 h-5 border border-gray-600 ${
            tailStyles[tailPosition.vertical].tail
          } transform rotate-45 box-border z-[-1] rounded-sm`}
        />

        <div className="flex flex-col w-96 rounded border border-gray-600 z-10">
          <span
            className={`absolute ${
              positionMap[tailPosition.horizontal].fixBorder
            } w-[11.52px] h-[1px] bg-gray-700 ${
              tailStyles[tailPosition.vertical].fixture
            } border-l-[1px] border-r-[1px] border-b-transparent border-l-gray-600 border-r-gray-600`}
          />
          <span className="bg-gray-700 px-3 pt-2 rounded-t">
            <Tabs
              tabs={tabs}
              activeTab={activeTab}
              onTabChange={setActiveTab}
            />
          </span>
          <span className="bg-gray-800 rounded-b text-xs">
            {[data.references, data.definitions]
              .filter((s) => s?.length)
              .map((items, index) => (
                <React.Fragment key={index}>
                  {items?.length ? (
                    <span
                      key={index}
                      className={`${
                        activeTab === index ? 'visible' : 'hidden'
                      } flex flex-col divide-y divide-gray-600 max-h-72 overflow-x-hidden pt-1`}
                    >
                      {items.length > 1 && (
                        <span className="pl-4 py-1 text-gray-400">
                          Found{' '}
                          <span className="text-gray-200">
                            {countItems(items)}{' '}
                            {tabs[activeTab]?.title.toLowerCase()}
                          </span>{' '}
                          in{' '}
                          <span className="text-gray-200">
                            {items.length} files
                          </span>
                        </span>
                      )}
                      {items.map((fileItem, i) => (
                        <React.Fragment
                          key={'snippet' + fileItem.path + index + i}
                        >
                          <span className="pl-3 text-xs">
                            <BreadcrumbsPath
                              path={fileItem.path}
                              repo={repoName}
                              activeStyle="secondary"
                            />
                          </span>
                          {fileItem.items.map((item, j) => (
                            <span
                              key={
                                'snippet' +
                                fileItem.path +
                                item.line +
                                index +
                                i +
                                j
                              }
                              className="py-1 overflow-x-auto hide-scrollbar pr-3 flex-shrink-0 cursor-pointer"
                              onClick={() => onRefDefClick(item, fileItem.path)}
                            >
                              <Code
                                code={item.code}
                                lineStart={item.line}
                                language={language}
                                removePaddings
                                lineHoverEffect
                              />
                            </span>
                          ))}
                        </React.Fragment>
                      ))}
                    </span>
                  ) : (
                    ''
                  )}
                </React.Fragment>
              ))}
          </span>
        </div>
      </div>
    );
  };

  return (
    <Tippy
      placement={
        `bottom${positionMapping[position]}` as TippyProps['placement']
      }
      interactive
      trigger="click"
      appendTo={(ref) => ref.ownerDocument.body}
      onShow={onHover}
      render={renderTooltip}
    >
      <span className={'cursor-pointer'}>{children}</span>
    </Tippy>
  );
};

export default TooltipCode;
