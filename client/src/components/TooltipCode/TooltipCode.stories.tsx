import { MemoryRouter } from 'react-router-dom';
import TooltipCode from './index';

export default {
  title: 'components/TooltipCode',
  component: TooltipCode,
};

export const TooltipCodeDefault = () => {
  return (
    <MemoryRouter initialEntries={['']}>
      <div style={{ backgroundColor: '#131315' }}>
        <div className="flex flex-col gap-8 items-center">
          <TooltipCode
            position={'left'}
            language={'javascript'}
            onHover={() => {}}
            repoName={'bloop'}
            queryParams={''}
            onRefDefClick={() => {}}
            data={{
              data: [
                {
                  file: '/src/root/service/longFolderName/oneMoreNestedFolder/index.tsx',
                  data: [
                    {
                      kind: 'reference',
                      start: {
                        byte: 0,
                        line: 1,
                        column: 1,
                      },
                      end: {
                        byte: 3,
                        line: 1,
                        column: 3,
                      },
                      snippet: {
                        data: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                        highlights: [{ start: 0, end: 3 }],
                        symbols: [],
                        line_range: {
                          start: 12,
                          end: 12,
                        },
                      },
                    },
                  ],
                },
              ],
            }}
          >
            <span>Tooltip Left</span>
          </TooltipCode>
          <TooltipCode
            position={'center'}
            language={'javascript'}
            onHover={() => {}}
            onRefDefClick={() => {}}
            queryParams={''}
            repoName={'bloop'}
            data={{
              data: [
                {
                  file: '/src/root/service/longFolderName/oneMoreNestedFolder/index.tsx',
                  data: [
                    {
                      kind: 'reference',
                      start: {
                        byte: 0,
                        line: 1,
                        column: 1,
                      },
                      end: {
                        byte: 3,
                        line: 1,
                        column: 3,
                      },
                      snippet: {
                        data: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                        highlights: [{ start: 0, end: 3 }],
                        symbols: [],
                        line_range: {
                          start: 12,
                          end: 12,
                        },
                      },
                    },
                  ],
                },
              ],
            }}
          >
            <span>Tooltip Center</span>
          </TooltipCode>
          <TooltipCode
            position={'right'}
            language={'javascript'}
            onHover={() => {}}
            onRefDefClick={() => {}}
            queryParams={''}
            repoName={'bloop'}
            data={{
              data: [
                {
                  file: '/src/root/service/longFolderName/oneMoreNestedFolder/index.tsx',
                  data: [
                    {
                      kind: 'reference',
                      start: {
                        byte: 0,
                        line: 1,
                        column: 1,
                      },
                      end: {
                        byte: 3,
                        line: 1,
                        column: 3,
                      },
                      snippet: {
                        data: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                        highlights: [{ start: 0, end: 3 }],
                        symbols: [],
                        line_range: {
                          start: 12,
                          end: 12,
                        },
                      },
                    },
                  ],
                },
              ],
            }}
          >
            <span>Tooltip right</span>
          </TooltipCode>
        </div>
      </div>
    </MemoryRouter>
  );
};
