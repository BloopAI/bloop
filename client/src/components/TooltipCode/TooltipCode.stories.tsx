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
            isLoading={false}
            position={'left'}
            language={'javascript'}
            onHover={() => {}}
            repoName={'bloop'}
            onRefDefClick={() => {}}
            data={{
              references: [
                {
                  path: '/src/root/service/longFolderName/oneMoreNestedFolder/index.tsx',
                  items: [
                    {
                      code: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                      line: 12,
                      highlights: [],
                    },
                  ],
                },
              ],
              definitions: [
                {
                  path: '/src/root/service',
                  items: [
                    {
                      code: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                      line: 12,
                      highlights: [],
                    },
                    {
                      code: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                      line: 12,
                      highlights: [],
                    },
                  ],
                },
                {
                  path: '/src/root/controller',
                  items: [
                    {
                      code: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                      line: 12,
                      highlights: [],
                    },
                    {
                      code: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                      line: 12,
                      highlights: [],
                    },
                  ],
                },
              ],
            }}
          >
            <span>Tooltip Left</span>
          </TooltipCode>
          <TooltipCode
            isLoading={false}
            position={'center'}
            language={'javascript'}
            onHover={() => {}}
            onRefDefClick={() => {}}
            repoName={'bloop'}
            data={{
              references: [
                {
                  path: '/src/root/service',
                  items: [
                    {
                      code: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                      line: 12,
                      highlights: [],
                    },
                  ],
                },
              ],
              definitions: [
                {
                  path: '/src/root/service',
                  items: [
                    {
                      code: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                      line: 12,
                      highlights: [],
                    },
                    {
                      code: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                      line: 12,
                      highlights: [],
                    },
                  ],
                },
                {
                  path: '/src/root/controller',
                  items: [
                    {
                      code: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                      line: 12,
                      highlights: [],
                    },
                    {
                      code: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                      line: 12,
                      highlights: [],
                    },
                  ],
                },
              ],
            }}
          >
            <span>Tooltip Center</span>
          </TooltipCode>
          <TooltipCode
            isLoading={false}
            position={'right'}
            language={'javascript'}
            onHover={() => {}}
            onRefDefClick={() => {}}
            repoName={'bloop'}
            data={{
              references: [
                {
                  path: '/src/root/service',
                  items: [
                    {
                      code: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                      line: 12,
                      highlights: [],
                    },
                  ],
                },
              ],
              definitions: [
                {
                  path: '/src/root/service',
                  items: [
                    {
                      code: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                      line: 12,
                      highlights: [],
                    },
                    {
                      code: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                      line: 12,
                      highlights: [],
                    },
                  ],
                },
                {
                  path: '/src/root/controller',
                  items: [
                    {
                      code: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                      line: 12,
                      highlights: [],
                    },
                    {
                      code: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                      line: 12,
                      highlights: [],
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
