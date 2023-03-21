import { useEffect, useRef, useState } from 'react';
import { mockCommits } from '../../mocks';
import CodeFull from './CodeFull/index';

export default {
  title: 'components/CodeFull',
  component: CodeFull,
};
const code = `
  import { SnippetTypingInfo } from "../types";
  import { getTextDiff } from "./snippetUtils";

  export const mergeObjRanges = (ranges: { start: number; end: number }[]) => {
    if (!ranges.length) {
      return [];
    }

    const sortedSimpleRanges = ranges.sort((a, b) => a.start - b.start);

    const results = [];
    let prev;
    sortedSimpleRanges.forEach((r) => {
      if (!prev) {
        prev = r;
        return;
      }
      if (prev.end === r.start || prev.end === r.start - 1) {
        prev = { start: prev.start, end: r.end };
        return;
      }
      results.push(prev);
      prev = r;
    });
    results.push(prev);
    return results;
  };

  export const mapRanges = (
    original: string,
    modified: string,
    metadata: SnippetTypingInfo[],
  ) => {
    // Metadata ranges will never be overlapping or touching.
    const updated = [];
    const ivs = getTextDiff(original, modified);

    for (let ridx = 0; ridx < metadata.length; ridx++) {
      const rng = metadata[ridx];
      const blocks = ivs.search([rng.start, rng.end - 1]);

      for (let bidx = 0; bidx < blocks.length; bidx++) {
        const bs = blocks[bidx].aoff;
        const be = blocks[bidx].aoff + blocks[bidx].sz;
        const s = Math.max(bs, rng.start);
        const e = Math.min(be, rng.end);

        if (s >= e) continue;
        updated.push({
          ...rng,
          ...{
            start: s - bs + blocks[bidx].boff,
            end: e - bs + blocks[bidx].boff,
          },
        });
      }
    }

    return updated
      .filter((r) => r.start >= 0 && r.end > 0)
      .sort((a, b) => {
        return a.start - b.start;
      });
  };
  `;

export const CodeBlockFull = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollElem, setScrollElem] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    setScrollElem(scrollRef.current);
  });
  return (
    <div style={{ width: 1000, backgroundColor: '' }}>
      <div className="h-screen overflow-scroll" ref={scrollRef}>
        <CodeFull
          code={code}
          language={'typescript'}
          scrollElement={scrollElem}
          repoPath={''}
          relativePath={''}
          repoName={'bloop'}
          containerWidth={window.innerWidth * 0.6}
          containerHeight={window.innerHeight}
          metadata={{
            lexicalBlocks: [
              { start: 4, end: 27 },
              { start: 33, end: 64 },
            ],
            hoverableRanges: [
              // { start: 54, end: 67 },
              // { start: 222, end: 242 },
            ],
          }}
        />
      </div>
    </div>
  );
};

export const CodeBlockFullWithBlame = () => {
  const code = `listen(_: unknown, event: string, arg?: any): Event<any> {
 switch (event) {
  default: throw new Error('no apples');
 }
}
client2.registerChannel('client2', {
 call(_: unknown, command: string, arg: any, cancellationToken: CancellationToken): Promise<any> {
   switch (command) {
    case 'testMethodClient2': return Promise.resolve('success2');
    default: return Promise.reject(new Error('no apples'));
   }
 }
}
client2.registerChannel('client2', {
 call(_: unknown, command: string, arg: any, cancellationToken: CancellationToken): Promise<any> {
   switch (command) {
    case 'testMethodClient2': return Promise.resolve('success2');
    default: return Promise.reject(new Error('no apples'));
   }
 }
}`;

  const scrollRef = useRef<HTMLDivElement>(null);
  const [scrollElem, setScrollElem] = useState<HTMLDivElement | null>(null);
  useEffect(() => {
    setScrollElem(scrollRef.current);
  });
  return (
    <div style={{ width: 1000, backgroundColor: '' }}>
      <div className="h-screen overflow-scroll" ref={scrollRef}>
        <CodeFull
          code={code}
          language={'typescript'}
          scrollElement={scrollElem}
          containerWidth={window.innerWidth * 0.6}
          containerHeight={window.innerHeight}
          repoPath={''}
          relativePath={''}
          repoName={'bloop'}
          metadata={{
            lexicalBlocks: [],
            hoverableRanges: [],
            blame: [
              {
                commit: mockCommits[0],
                lineRange: {
                  start: 0,
                  end: 3,
                },
              },
              {
                commit: mockCommits[0],
                lineRange: {
                  start: 4,
                  end: 6,
                },
              },
              {
                commit: mockCommits[0],
                lineRange: {
                  start: 7,
                  end: 8,
                },
              },
              {
                commit: mockCommits[0],
                lineRange: {
                  start: 9,
                  end: 12,
                },
              },
              {
                commit: mockCommits[0],
                lineRange: {
                  start: 13,
                  end: 17,
                },
              },
              {
                commit: mockCommits[0],
                lineRange: {
                  start: 18,
                  end: 20,
                },
              },
            ],
          }}
        />
      </div>
    </div>
  );
};
