import { memo } from 'react';
import {
  ParsedQueryType,
  ParsedQueryTypeEnum,
} from '../../../../../types/general';
import PathChip from './PathChip';
import LangChip from './LangChip';
import RepoChip from './RepoChip';

type Props = {
  textQuery: string;
  parsedQuery?: ParsedQueryType[];
};

const UserParsedQuery = ({ textQuery, parsedQuery }: Props) => {
  return (
    <span className="">
      {parsedQuery
        ? parsedQuery.map((p, i) =>
            p.type === ParsedQueryTypeEnum.TEXT ? (
              p.text
            ) : p.type === ParsedQueryTypeEnum.PATH ? (
              <PathChip path={p.text} key={i} />
            ) : p.type === ParsedQueryTypeEnum.LANG ? (
              <LangChip lang={p.text} key={i} />
            ) : p.type === ParsedQueryTypeEnum.REPO ? (
              <RepoChip name={p.text} key={i} />
            ) : null,
          )
        : textQuery}
    </span>
  );
};

export default memo(UserParsedQuery);
