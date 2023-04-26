/*
 * https://github.com/FormidableLabs/prism-react-renderer/blob/master/src/utils/normalizeTokens.js
 * */

import Prism from 'prismjs';
import 'prismjs/components/prism-typescript.min';
import 'prismjs/components/prism-jsx.min';
import 'prismjs/components/prism-tsx.min';
import 'prismjs/components/prism-python.min';
import 'prismjs/components/prism-rust.min';
import 'prismjs/components/prism-scheme.min';
import 'prismjs/components/prism-json.min';
import 'prismjs/components/prism-markdown.min';
import 'prismjs/components/prism-toml.min';
import 'prismjs/components/prism-yaml.min';
import 'prismjs/components/prism-bash.min';
import 'prismjs/components/prism-graphql.min';
import 'prismjs/components/prism-kotlin.min';
import 'prismjs/components/prism-r.min';
import 'prismjs/components/prism-batch.min';
import 'prismjs/components/prism-ruby.min';
import 'prismjs/components/prism-go.min';
import 'prismjs/components/prism-ini.min';
import 'prismjs/components/prism-gradle.min';
import 'prismjs/components/prism-perl.min';
import 'prismjs/components/prism-java.min';
import 'prismjs/components/prism-csharp.min';
import 'prismjs/components/prism-erlang.min';
import 'prismjs/components/prism-c.min';
import 'prismjs/components/prism-swift.min';
import 'prismjs/components/prism-markup-templating.min';
import 'prismjs/components/prism-php.min';
import 'prismjs/components/prism-cpp.min';
import 'prismjs/components/prism-scss.min';
import 'prismjs/components/prism-less.min';
import 'prismjs/components/prism-scala.min';
import 'prismjs/components/prism-julia.min';
import type { Token } from '../types/prism';
import '../prism-vsc-dark-plus.css';

const newlineRe = /\r\n|\r|\n/;

type LineEndings = 'CRLF' | 'LF';

// Empty lines need to contain a single empty token, denoted with { empty: true }
const normalizeEmptyLines = (line: Token[]) => {
  if (line.length === 0) {
    line.push({
      types: ['plain'],
      content: '\n',
      empty: true,
      byteRange: { start: 0, end: 0 },
    });
  } else if (line.length === 1 && line[0].content === '') {
    line[0].content = '\n';
    line[0].empty = true;
  }
};

const appendTypes = (types: string[], add: string[] | string): string[] => {
  const typesSize = types.length;
  if (typesSize > 0 && types[typesSize - 1] === add) {
    return types;
  }

  return types.concat(add);
};

const normalizeWhitespaces = (tokens: Token[][]) => {
  const normalized: Token[][] = [];
  tokens.forEach((line) => {
    const lineTokens: Token[] = [];
    line.forEach((token) => {
      const data = token.content.match(/^(\s*)([^\s]+)(\s*)$/);

      if (!data || (data[1] == null && data[3] === null)) {
        lineTokens.push(token);
        return;
      }
      if (data[1]) {
        lineTokens.push({
          types: ['plain'],
          content: data[1],
          empty: false,
          byteRange: { start: 0, end: 0 },
        });
      }
      lineTokens.push({
        ...token,
        content: data[2],
      });
      if (data[3]) {
        lineTokens.push({
          types: ['plain'],
          content: data[3],
          empty: false,
          byteRange: { start: 0, end: 0 },
        });
      }
    });
    normalized.push(lineTokens);
  });
  return normalized;
};

const appendRanges = (tokens: Token[][], lineEndings: 'CRLF' | 'LF') => {
  let b = 0;
  return tokens.map((line) => {
    const lt = line.map((token) => {
      const tokenLengthInBytes = new TextEncoder().encode(token.content).length;
      const currRange = { start: b, end: b + tokenLengthInBytes };
      if (!token.empty && tokenLengthInBytes) {
        b += tokenLengthInBytes;
      }
      return { ...token, byteRange: currRange };
    });
    b += lineEndings === 'CRLF' ? 2 : 1;
    return lt;
  });
};

// Takes an array of Prism's tokens and groups them by line, turning plain
// strings into tokens as well. Tokens can become recursive in some cases,
// which means that their types are concatenated. Plain-string tokens however
// are always of type "plain".
// This is not recursive to avoid exceeding the call-stack limit, since it's unclear
// how nested Prism's tokens can become
const normalizeTokens = (
  tokens: Array<Prism.Token | string>,
  lineEndings: 'CRLF' | 'LF',
): Token[][] => {
  const typeArrStack: string[][] = [[]];
  const tokenArrStack = [tokens];
  const tokenArrIndexStack = [0];
  const tokenArrSizeStack = [tokens.length];

  let i = 0;
  let stackIndex = 0;
  let currentLine: Token[] = [];

  let bytes = 0;
  const acc = [currentLine];

  while (stackIndex > -1) {
    while (
      (i = tokenArrIndexStack[stackIndex]++) < tokenArrSizeStack[stackIndex]
    ) {
      let content;
      let types = typeArrStack[stackIndex];

      const tokenArr = tokenArrStack[stackIndex];
      const token = tokenArr[i];

      // Determine content and append type to types if necessary
      let currRange = null;

      if (typeof token === 'string') {
        types = stackIndex > 0 ? types : ['plain'];
        content = token;
      } else {
        types = appendTypes(types, token.type);
        if (token.alias) {
          types = appendTypes(types, token.alias);
        }

        content = token.content;
      }

      // If token.content is an array, increase the stack depth and repeat this while-loop
      if (typeof content !== 'string') {
        stackIndex++;
        typeArrStack.push(types);
        tokenArrStack.push(content as any);
        tokenArrIndexStack.push(0);
        tokenArrSizeStack.push(content.length);
        continue;
      }

      // Split by newlines
      const splitByNewlines = content.split(newlineRe);
      const newlineCount = splitByNewlines.length;

      currentLine.push({
        types,
        content: splitByNewlines[0],
        byteRange: { start: 0, end: 0 },
      });

      // Create a new line for each string on a new line
      for (let i = 1; i < newlineCount; i++) {
        normalizeEmptyLines(currentLine);
        acc.push((currentLine = []));
        currentLine.push({
          types,
          content: splitByNewlines[i],
          byteRange: { start: 0, end: 0 },
        });
      }
    }

    // Decrease the stack depth
    stackIndex--;
    typeArrStack.pop();
    tokenArrStack.pop();
    tokenArrIndexStack.pop();
    tokenArrSizeStack.pop();
  }

  normalizeEmptyLines(currentLine);

  return appendRanges(normalizeWhitespaces(acc), lineEndings);
};

export const getPrismLanguage = (lang: string) => {
  const langMap = {
    JavaScript: 'jsx',
    TypeScript: 'tsx',
    'C#': 'csharp',
    'C++': 'cpp',
    'c++': 'cpp',
  };
  // @ts-ignore
  return langMap[lang] || lang?.toLowerCase() || 'plain';
};

function getLineEnding(content: string): LineEndings | undefined {
  const matched = content.match(/\r\n|\r|\n/);
  if (matched) {
    const returned = {
      '\r': 'CR',
      '\n': 'LF',
      '\r\n': 'CRLF',
    }[matched[0]];

    return returned as LineEndings;
  }
}

export const tokenizeCode = (code: string, lang: string) => {
  const lineEndings = getLineEnding(code);
  const tokens = Prism.tokenize(
    code,
    Prism.languages[lang] || Prism.languages.plaintext,
  );
  return normalizeTokens(tokens, lineEndings!);
};

export const highlightCode = (code: string, lang: string) => {
  if (!code) {
    return code;
  }
  return Prism.highlight(
    code,
    Prism.languages[lang] || Prism.languages.plaintext,
    lang,
  );
};

export default normalizeTokens;
