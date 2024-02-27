import { ParsedQueryTypeEnum } from '../types/general';
import {
  getCommonFolder,
  getFileExtensionForLang,
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
});
