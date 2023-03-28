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
            onRefDefClick={() => {}}
            data={{
              references: [
                {
                  path: '/src/root/service/longFolderName/oneMoreNestedFolder/index.tsx',
                  items: [
                    {
                      code: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                      line: 12,
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
                    },
                    {
                      code: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                      line: 12,
                    },
                  ],
                },
                {
                  path: '/src/root/controller',
                  items: [
                    {
                      code: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                      line: 12,
                    },
                    {
                      code: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                      line: 12,
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
              references: [
                {
                  path: '/src/root/service',
                  items: [
                    {
                      code: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                      line: 12,
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
                    },
                    {
                      code: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                      line: 12,
                    },
                  ],
                },
                {
                  path: '/src/root/controller',
                  items: [
                    {
                      code: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                      line: 12,
                    },
                    {
                      code: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                      line: 12,
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
              references: [
                {
                  path: '/src/root/service',
                  items: [
                    {
                      code: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                      line: 12,
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
                    },
                    {
                      code: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                      line: 12,
                    },
                  ],
                },
                {
                  path: '/src/root/controller',
                  items: [
                    {
                      code: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                      line: 12,
                    },
                    {
                      code: 'func Adapt(fn Command) func(cmd *cobra.Command, args []string) error {',
                      line: 12,
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
