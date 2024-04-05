import { ParsedQueryTypeEnum } from '../types/general';
import {
  concatenateParsedQuery,
  getCommonFolder,
  getFileExtensionForLang,
  humanNumber,
  mergeRanges,
  splitUserInputAfterAutocomplete,
} from './index';

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
    test('repo filter after lang filter in the middle', () => {
      expect(
        JSON.stringify(
          splitUserInputAfterAutocomplete(
            'my |lang:TypeScript| simple |repo:BloopAI/bloop| string',
          ),
        ),
      ).toEqual(
        JSON.stringify([
          { type: ParsedQueryTypeEnum.TEXT, text: 'my ' },
          { type: ParsedQueryTypeEnum.LANG, text: 'TypeScript' },
          { type: ParsedQueryTypeEnum.TEXT, text: ' simple ' },
          { type: ParsedQueryTypeEnum.REPO, text: 'BloopAI/bloop' },
          { type: ParsedQueryTypeEnum.TEXT, text: ' string' },
        ]),
      );
    });
  });
  describe('getFileExtensionForLang', () => {
    test('main languages', () => {
      expect(getFileExtensionForLang('JavaScript')).toEqual('index.js');
      expect(getFileExtensionForLang('TypeScript')).toEqual('index.ts');
      expect(getFileExtensionForLang('JSX')).toEqual('index.jsx');
      expect(getFileExtensionForLang('Rust')).toEqual('index.rs');
    });
    test('lowercased', () => {
      expect(getFileExtensionForLang('javascript', true)).toEqual('index.js');
      expect(getFileExtensionForLang('typescript', true)).toEqual('index.ts');
      expect(getFileExtensionForLang('jsx', true)).toEqual('index.jsx');
      expect(getFileExtensionForLang('rust', true)).toEqual('index.rs');
    });
    test('unknown languages', () => {
      expect(getFileExtensionForLang('asd', true)).toEqual('index.asd');
      expect(getFileExtensionForLang('ASD')).toEqual('index.ASD');
      expect(getFileExtensionForLang('Asd')).toEqual('index.Asd');
    });
    test('empty input', () => {
      expect(getFileExtensionForLang('', true)).toEqual('default');
      expect(getFileExtensionForLang('')).toEqual('default');
    });
  });
  describe('getCommonFolder', () => {
    test('no folder', () => {
      expect(getCommonFolder(['index.js', '.gitignore'])).toEqual('');
    });
    test('no common folder', () => {
      expect(getCommonFolder(['src/index.js', 'public/.gitignore'])).toEqual(
        '',
      );
      expect(getCommonFolder(['/src/index.js', '/public/.gitignore'])).toEqual(
        '',
      );
      expect(
        getCommonFolder(['src/index.js', 'public/src/.gitignore']),
      ).toEqual('');
    });
    test('one common folder', () => {
      expect(
        getCommonFolder(['src/components/index.js', 'src/utils.js']),
      ).toEqual('src');
      expect(
        getCommonFolder(['src/components/index.js', 'src/utils/utils.js']),
      ).toEqual('src');
    });
    test('two common folders', () => {
      expect(
        getCommonFolder(['src/components/index.js', 'src/components/utils.js']),
      ).toEqual('src/components');
    });
    test('windows path', () => {
      expect(
        getCommonFolder([
          '\\src\\components\\index.js',
          '\\src\\components\\utils.js',
        ]),
      ).toEqual('\\src\\components');
    });
    test('empty input', () => {
      expect(getCommonFolder([])).toEqual('/');
    });
  });
  describe('concatenateParsedQuery', () => {
    test('no filters used', () => {
      expect(
        concatenateParsedQuery([
          { type: ParsedQueryTypeEnum.TEXT, text: 'Hello world!' },
        ]),
      ).toEqual('Hello world!');
      expect(
        concatenateParsedQuery([
          { type: ParsedQueryTypeEnum.TEXT, text: 'Hello' },
          { type: ParsedQueryTypeEnum.TEXT, text: ' world!' },
        ]),
      ).toEqual('Hello world!');
    });
    test('filters used', () => {
      expect(
        concatenateParsedQuery([
          { type: ParsedQueryTypeEnum.TEXT, text: 'Hello ' },
          { type: ParsedQueryTypeEnum.LANG, text: 'js' },
          { type: ParsedQueryTypeEnum.TEXT, text: ' world ' },
          { type: ParsedQueryTypeEnum.REPO, text: 'BloopAI/bloop' },
          { type: ParsedQueryTypeEnum.TEXT, text: ' ' },
          { type: ParsedQueryTypeEnum.PATH, text: 'src/index.js' },
          { type: ParsedQueryTypeEnum.TEXT, text: ' ? ' },
          { type: ParsedQueryTypeEnum.BRANCH, text: 'origin/main' },
          { type: ParsedQueryTypeEnum.PATH, text: 'src/components/index.js' },
        ]),
      ).toEqual(
        'Hello |lang:js| world |repo:BloopAI/bloop| |path:src/index.js| ? |path:src/components/index.js|',
      );
    });
  });
  describe('mergeRanges', () => {
    test('empty ranges', () => {
      expect(mergeRanges([])).toEqual([]);
    });
    test('no overlap ranges', () => {
      expect(
        mergeRanges([
          [1, 5],
          [7, 10],
        ]),
      ).toEqual([
        [1, 5],
        [7, 10],
      ]);
      expect(
        mergeRanges([
          [7, 10],
          [1, 5],
        ]),
      ).toEqual([
        [1, 5],
        [7, 10],
      ]);
    });
    test('no overlap ranges next to each other', () => {
      expect(
        mergeRanges([
          [1, 5],
          [6, 10],
        ]),
      ).toEqual([[1, 10]]);
      expect(
        mergeRanges([
          [7, 10],
          [1, 5],
          [11, 15],
        ]),
      ).toEqual([
        [1, 5],
        [7, 15],
      ]);
    });
    test('overlap ranges', () => {
      expect(
        mergeRanges([
          [1, 5],
          [3, 10],
        ]),
      ).toEqual([[1, 10]]);
      expect(
        mergeRanges([
          [7, 10],
          [1, 5],
          [9, 15],
        ]),
      ).toEqual([
        [1, 5],
        [7, 15],
      ]);
    });
  });
  describe('humanNumber', () => {
    test('< 1000', () => {
      expect(humanNumber(123)).toEqual('123');
      expect(humanNumber(999)).toEqual('999');
      expect(humanNumber(5)).toEqual('5');
    });
    test('> 1000', () => {
      expect(humanNumber(1000)).toEqual('1k');
      expect(humanNumber(1001)).toEqual('1k');
      expect(humanNumber(5432)).toEqual('5.4k');
      expect(humanNumber(5999)).toEqual('6k');
      expect(humanNumber(10009)).toEqual('10k');
      expect(humanNumber(100009)).toEqual('100k');
      expect(humanNumber(1000009)).toEqual('1000k');
    });
    test('none', () => {
      expect(humanNumber(0)).toEqual(0);
    });
  });
});
