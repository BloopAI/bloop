import flatten from 'lodash.flatten';
import { ConversationExchangeType, SearchStepType } from '../types/api';
import {
  ChatLoadingStep,
  ParsedQueryType,
  ParsedQueryTypeEnum,
} from '../types/general';

export const mapLoadingSteps = (
  searchSteps: SearchStepType[],
  t: (key: string) => string,
) => {
  const arr: (ChatLoadingStep | ChatLoadingStep[])[] = searchSteps.map((s) => {
    if (s.type === 'proc') {
      return s.content.paths.map((pa) => ({
        ...s,
        path: pa.path || '',
        repo: pa.repo,
        displayText:
          t(`Reading`) +
          ' ' +
          `${pa?.path?.length > 20 ? '...' : ''}${pa?.path?.slice(-20)}`,
      }));
    }
    return {
      ...s,
      path: s.content.query,
      displayText: s.content.query,
    };
  });
  return flatten(arr);
};

const mapQueryParts = (query: ConversationExchangeType['query']) => {
  const array: {
    type: ParsedQueryTypeEnum;
    start: number;
    end: number;
    text: string;
  }[] = [];
  (
    [
      'paths',
      'langs',
      'repos',
      'branch',
    ] as (keyof ConversationExchangeType['query'])[]
  ).forEach((key) => {
    array.push(
      // @ts-ignore
      ...query[key].map((s) => ({
        type: key === 'branch' ? key : key.slice(0, -1),
        start: s.Plain.start,
        end: s.Plain.end,
        text: s.Plain.content,
      })),
    );
  });
  return array;
};

export const mapUserQuery = (
  m: ConversationExchangeType,
): ParsedQueryType[] => {
  const parsedQuery = [];
  const parts = mapQueryParts(m.query).sort((a, b) => a.start - b.start);
  let currentIndex = 0;
  const originalString = m.query.raw_query;

  for (const item of parts) {
    if (currentIndex < item.start) {
      const textBefore = originalString.substring(
        currentIndex,
        item.start - item.type.length - 1,
      );
      parsedQuery.push({ type: ParsedQueryTypeEnum.TEXT, text: textBefore });
      currentIndex = item.start - item.type.length - 1;
    }

    parsedQuery.push({ type: item.type, text: item.text });
    currentIndex = item.end;
  }

  if (currentIndex < originalString.length) {
    const textAfter = originalString.substring(currentIndex);
    parsedQuery.push({ type: ParsedQueryTypeEnum.TEXT, text: textAfter });
  }

  return parsedQuery;
};
