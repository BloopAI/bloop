import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { format as timeAgo } from 'timeago.js';
import { Clipboard, Commit } from '../../icons';
import Button from '../Button';
import { copyToClipboard } from '../../utils';
import { Commit as CommitType } from '../../types';

export type CommitDate = {
  date: number;
  commits: CommitType[];
};

type Props = {
  commits: CommitType[];
  showFirstSeparator?: boolean;
};

const CommitHistory = ({ commits, showFirstSeparator = true }: Props) => {
  const [sortedCommits, setSortedCommits] = useState<CommitDate[]>([]);
  useEffect(() => {
    const cc: CommitDate[] = [];
    commits
      .sort((a, b) => b.datetime - a.datetime)
      .forEach((commit, index, array) => {
        const date = new Date(commit.datetime).getDate();

        if (
          index === 0 ||
          new Date(array[index - 1].datetime).getDate() !== date
        ) {
          cc.push({ date: commit.datetime, commits: [commit] });
        } else {
          cc[cc.length - 1].commits.push(commit);
        }
      });
    setSortedCommits(cc);
  }, [commits]);

  return (
    <div className="pt-2 w-full">
      {showFirstSeparator && (
        <span className="h-4 border-r pl-2.5 border-bg-border w-full"></span>
      )}
      {sortedCommits.map((commitDate) => (
        <div key={commitDate.date}>
          <div className="text-label-base text-sm flex flex-row py-1">
            <Commit />
            <span className="pl-2 select-none">
              Commits on {format(commitDate.date, 'MMM d,y')}
            </span>
          </div>
          <div className="flex flex-row gap-4 flex-1">
            <span className="border-r pl-2.5 border-bg-border block"></span>
            <div className="rounded border border-bg-border divide-y divide-bg-border gap-2 my-4 w-full">
              {commitDate.commits.map((commit) => (
                <span
                  key={commit.hash}
                  className="flex flex-row items-center p-3 gap-12 bg-bg-sub first:rounded-t last:rounded-b"
                >
                  <span className="flex flex-col gap-2 w-1/2">
                    <span className="text-label-base text-sm cursor-pointer hover:underline">
                      {commit.message}
                    </span>
                    <span className="flex flex-row text-xs items-center">
                      <span className="w-5 h-5 cursor-pointer select-none">
                        <img src={commit.image} />
                      </span>
                      <span className="text-label-base ml-3 cursor-pointer hover:underline">
                        {commit.author}
                      </span>
                      <span className="text-label-muted ml-1 select-none">
                        committed&nbsp;
                        {timeAgo(commit.datetime)}
                      </span>
                    </span>
                  </span>
                  <span className="flex flex-row items-center gap-2">
                    <span className="text-label-base text-sm">
                      {commit.hash}
                    </span>
                    <span className="text-label-muted">
                      <Button
                        onlyIcon
                        variant={'tertiary'}
                        onClick={() => copyToClipboard(commit.hash)}
                        title="Copy to clipboard"
                      >
                        <Clipboard />
                      </Button>
                    </span>
                  </span>
                </span>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
export default CommitHistory;
