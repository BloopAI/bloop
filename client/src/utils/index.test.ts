import { ParsedQueryTypeEnum } from '../types/general';
import { splitUserInputAfterAutocomplete } from './index';

describe('Utils', () => {
  describe('splitUserInputAfterAutocomplete', () => {
    test('simple string', () => {
      expect(
        JSON.stringify(splitUserInputAfterAutocomplete('my simple string')),
      ).toEqual(
        JSON.stringify([
          { type: ParsedQueryTypeEnum.TEXT, text: 'my simple string' },
        ]),
      );
    });
    test('filter at start', () => {
      expect(
        JSON.stringify(
          splitUserInputAfterAutocomplete('|lang:TypeScript| my simple string'),
        ),
      ).toEqual(
        JSON.stringify([
          { type: ParsedQueryTypeEnum.LANG, text: 'TypeScript' },
          { type: ParsedQueryTypeEnum.TEXT, text: ' my simple string' },
        ]),
      );
    });
    test('filter at the end', () => {
      expect(
        JSON.stringify(
          splitUserInputAfterAutocomplete('my simple string |lang:TypeScript|'),
        ),
      ).toEqual(
        JSON.stringify([
          { type: ParsedQueryTypeEnum.TEXT, text: 'my simple string ' },
          { type: ParsedQueryTypeEnum.LANG, text: 'TypeScript' },
        ]),
      );
    });
    test('lang filter in the middle', () => {
      expect(
        JSON.stringify(
          splitUserInputAfterAutocomplete('my simple |lang:TypeScript| string'),
        ),
      ).toEqual(
        JSON.stringify([
          { type: ParsedQueryTypeEnum.TEXT, text: 'my simple ' },
          { type: ParsedQueryTypeEnum.LANG, text: 'TypeScript' },
          { type: ParsedQueryTypeEnum.TEXT, text: ' string' },
        ]),
      );
    });
    test('path filter in the middle', () => {
      expect(
        JSON.stringify(
          splitUserInputAfterAutocomplete(
            'my |path:src/index.js| simple string',
          ),
        ),
      ).toEqual(
        JSON.stringify([
          { type: ParsedQueryTypeEnum.TEXT, text: 'my ' },
          { type: ParsedQueryTypeEnum.PATH, text: 'src/index.js' },
          { type: ParsedQueryTypeEnum.TEXT, text: ' simple string' },
        ]),
      );
    });
    test('lang filter after path filter in the middle', () => {
      expect(
        JSON.stringify(
          splitUserInputAfterAutocomplete(
            'my |path:src/index.js| simple |lang:TypeScript| string',
          ),
        ),
      ).toEqual(
        JSON.stringify([
          { type: ParsedQueryTypeEnum.TEXT, text: 'my ' },
          { type: ParsedQueryTypeEnum.PATH, text: 'src/index.js' },
          { type: ParsedQueryTypeEnum.TEXT, text: ' simple ' },
          { type: ParsedQueryTypeEnum.LANG, text: 'TypeScript' },
          { type: ParsedQueryTypeEnum.TEXT, text: ' string' },
        ]),
      );
    });
    test('path filter after lang filter in the middle', () => {
      expect(
        JSON.stringify(
          splitUserInputAfterAutocomplete(
            'my |lang:TypeScript| simple |path:src/index.js| string',
          ),
        ),
      ).toEqual(
        JSON.stringify([
          { type: ParsedQueryTypeEnum.TEXT, text: 'my ' },
          { type: ParsedQueryTypeEnum.LANG, text: 'TypeScript' },
          { type: ParsedQueryTypeEnum.TEXT, text: ' simple ' },
          { type: ParsedQueryTypeEnum.PATH, text: 'src/index.js' },
          { type: ParsedQueryTypeEnum.TEXT, text: ' string' },
        ]),
      );
    });
  });
});
