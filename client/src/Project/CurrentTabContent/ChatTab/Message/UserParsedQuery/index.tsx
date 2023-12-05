import { memo } from 'react';
import {
  ParsedQueryType,
  ParsedQueryTypeEnum,
} from '../../../../../types/general';
import PathChip from './PathChip';
import LangChip from './LangChip';

type Props = {
  textQuery: string;
  parsedQuery?: ParsedQueryType[];
};

const UserParsedQuery = ({ textQuery, parsedQuery }: Props) => {
  return (
    <div className="">
      {parsedQuery
        ? parsedQuery.map((p, i) =>
            p.type === ParsedQueryTypeEnum.TEXT ? (
              p.text
            ) : p.type === ParsedQueryTypeEnum.PATH ? (
              <PathChip path={p.text} key={i} />
            ) : p.type === ParsedQueryTypeEnum.LANG ? (
              <LangChip lang={p.text} key={i} />
            ) : null,
          )
        : textQuery}
    </div>
  );
};

export default memo(UserParsedQuery);
