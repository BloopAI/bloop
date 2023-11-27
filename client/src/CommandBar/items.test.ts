import { PRIVATE_REPOS, PUBLIC_REPOS } from '../consts/commandBar';
import { initApi } from '../services/api';
import { getActiveStepContent } from './items';

describe('command bar items functions', () => {
  describe('getActiveStepContent', () => {
    test('initial', async () => {
      expect(
        JSON.stringify(
          (
            await getActiveStepContent(
              // @ts-ignore
              () => 'blah',
              {
                id: 'initial',
                label: '',
              },
            )
          )?.parents,
        ),
      ).toEqual('[]');
    });
    test('initial -> private repos', async () => {
      initApi('http://localhost:7878/api');
      expect(
        JSON.stringify(
          (
            await getActiveStepContent(
              // @ts-ignore
              () => 'blah',
              {
                id: PRIVATE_REPOS,
                label: 'Private repos',
                parent: { id: 'initial', label: '' },
              },
            )
          )?.parents,
        ),
      ).toEqual('["initial"]');
    });
    test('initial -> public repos', async () => {
      expect(
        JSON.stringify(
          (
            await getActiveStepContent(
              // @ts-ignore
              () => 'blah',
              {
                id: PUBLIC_REPOS,
                label: 'Public repos',
                parent: { id: 'initial', label: '' },
              },
            )
          )?.parents,
        ),
      ).toEqual('["initial"]');
    });
    test('initial -> private repos -> bloop', async () => {
      expect(
        JSON.stringify(
          (
            await getActiveStepContent(
              // @ts-ignore
              () => 'blah',
              {
                id: 'bloop',
                label: 'bloop',
                parent: {
                  id: PRIVATE_REPOS,
                  label: 'Private repos',
                  parent: { id: 'initial', label: '' },
                },
              },
            )
          )?.parents,
        ),
      ).toEqual('["initial","private_repos"]');
    });
  });
});
