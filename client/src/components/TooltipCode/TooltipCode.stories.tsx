import { MemoryRouter } from 'react-router-dom';
import TooltipCode from './index';

export default {
  title: 'components/TooltipCode',
  component: TooltipCode,
};

export const TooltipCodeDefault = () => {
  return (
    <MemoryRouter initialEntries={['']}>
      <div>
        <div className="flex flex-col gap-8 items-center">
          <TooltipCode
            position={'left'}
            language={'javascript'}
            onHover={() => {}}
            repoName={'bloop'}
            onRefDefClick={() => {}}
            data={{
              tokenRange: { start: 0, end: 12 },
              hoverableRange: { start: 0, end: 12 },
              data: [
                {
                  file: '/src/root/service/longFolderName/oneMoreNestedFolder/index.tsx',
                  data: [
                    {
                      kind: 'definition',
                      snippet: {
                        data: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                        line_range: {
                          start: 12,
                          end: 12,
                        },
                        symbols: [],
                        highlights: [],
                      },
                      range: {
                        start: {
                          line: 12,
                          column: 1,
                          byte: 1,
                        },
                        end: {
                          line: 12,
                          column: 21,
                          byte: 21,
                        },
                      },
                    },
                  ],
                },
                {
                  file: '/src/root/service',
                  data: [
                    {
                      kind: 'definition',
                      snippet: {
                        data: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                        line_range: {
                          start: 12,
                          end: 12,
                        },
                        symbols: [],
                        highlights: [],
                      },
                      range: {
                        start: {
                          line: 12,
                          column: 1,
                          byte: 1,
                        },
                        end: {
                          line: 12,
                          column: 21,
                          byte: 21,
                        },
                      },
                    },
                    {
                      kind: 'reference',
                      snippet: {
                        data: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                        line_range: {
                          start: 12,
                          end: 12,
                        },
                        symbols: [],
                        highlights: [],
                      },
                      range: {
                        start: {
                          line: 12,
                          column: 1,
                          byte: 1,
                        },
                        end: {
                          line: 12,
                          column: 21,
                          byte: 21,
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
            repoName={'bloop'}
            data={{
              tokenRange: { start: 0, end: 12 },
              hoverableRange: { start: 0, end: 12 },
              data: [
                {
                  file: '/src/root/service/longFolderName/oneMoreNestedFolder/index.tsx',
                  data: [
                    {
                      kind: 'definition',
                      snippet: {
                        data: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                        line_range: {
                          start: 12,
                          end: 12,
                        },
                        symbols: [],
                        highlights: [],
                      },
                      range: {
                        start: {
                          line: 12,
                          column: 1,
                          byte: 1,
                        },
                        end: {
                          line: 12,
                          column: 21,
                          byte: 21,
                        },
                      },
                    },
                  ],
                },
                {
                  file: '/src/root/service',
                  data: [
                    {
                      kind: 'definition',
                      snippet: {
                        data: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                        line_range: {
                          start: 12,
                          end: 12,
                        },
                        symbols: [],
                        highlights: [],
                      },
                      range: {
                        start: {
                          line: 12,
                          column: 1,
                          byte: 1,
                        },
                        end: {
                          line: 12,
                          column: 21,
                          byte: 21,
                        },
                      },
                    },
                    {
                      kind: 'reference',
                      snippet: {
                        data: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                        line_range: {
                          start: 12,
                          end: 12,
                        },
                        symbols: [],
                        highlights: [],
                      },
                      range: {
                        start: {
                          line: 12,
                          column: 1,
                          byte: 1,
                        },
                        end: {
                          line: 12,
                          column: 21,
                          byte: 21,
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
            repoName={'bloop'}
            data={{
              tokenRange: { start: 0, end: 12 },
              hoverableRange: { start: 0, end: 12 },
              data: [
                {
                  file: '/src/root/service/longFolderName/oneMoreNestedFolder/index.tsx',
                  data: [
                    {
                      kind: 'definition',
                      snippet: {
                        data: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                        line_range: {
                          start: 12,
                          end: 12,
                        },
                        symbols: [],
                        highlights: [],
                      },
                      range: {
                        start: {
                          line: 12,
                          column: 1,
                          byte: 1,
                        },
                        end: {
                          line: 12,
                          column: 21,
                          byte: 21,
                        },
                      },
                    },
                  ],
                },
                {
                  file: '/src/root/service',
                  data: [
                    {
                      kind: 'definition',
                      snippet: {
                        data: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                        line_range: {
                          start: 12,
                          end: 12,
                        },
                        symbols: [],
                        highlights: [],
                      },
                      range: {
                        start: {
                          line: 12,
                          column: 1,
                          byte: 1,
                        },
                        end: {
                          line: 12,
                          column: 21,
                          byte: 21,
                        },
                      },
                    },
                    {
                      kind: 'reference',
                      snippet: {
                        data: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                        line_range: {
                          start: 12,
                          end: 12,
                        },
                        symbols: [],
                        highlights: [],
                      },
                      range: {
                        start: {
                          line: 12,
                          column: 1,
                          byte: 1,
                        },
                        end: {
                          line: 12,
                          column: 21,
                          byte: 21,
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
