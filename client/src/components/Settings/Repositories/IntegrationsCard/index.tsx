import { ReactElement } from 'react';
import Button from '../../../Button';
import { ChevronRight, GitHubLogo, Repository } from '../../../../icons';
import Badge from '../../Badge';

type Props = {
  type: 'github' | 'local';
  title: string;
  btnText: string;
  syncNumber: number;
  totalNumber: number;
  syncError?: boolean;
  btnDisabled?: boolean;
  onViewReposClick: () => void;
  nearBtnEl?: ReactElement | null;
  onBtnClick: () => void;
};

const IntegrationsCard = ({
  type,
  title,
  syncNumber,
  syncError,
  onViewReposClick,
  totalNumber,
  nearBtnEl,
  onBtnClick,
  btnText,
  btnDisabled,
}: Props) => {
  return (
    <div className="border border-gray-800 shadow-light rounded-4 p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-3 callout items-center">
          {type === 'github' ? <GitHubLogo /> : <Repository />}
          {title}
        </div>
        {totalNumber ? (
          <Button variant="tertiary" size="small" onClick={onViewReposClick}>
            View repositories <ChevronRight />
          </Button>
        ) : !syncError ? (
          <div className="flex gap-2 flex-shrink-0 items-center">
            {nearBtnEl}
            <Button
              variant="secondary"
              size="small"
              onClick={onBtnClick}
              disabled={btnDisabled}
            >
              {btnText}
            </Button>
          </div>
        ) : null}
      </div>
      {totalNumber || syncError ? (
        <>
          <div className="h-2 flex items-center p-1 pl-8">
            <hr className="border-gray-800 w-full" />
          </div>
          {totalNumber ? (
            <div className="flex items-center justify-between">
              <p className="text-gray-500 caption">
                {syncNumber} {type === 'github' ? 'GitHub' : 'local'}{' '}
                repositories synced
              </p>
              <Button variant="secondary" size="small">
                {type === 'github' ? 'Disconnect' : 'Pause local scans'}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <Badge>
                {type === 'github' ? 'Connection lost' : 'Local scans paused'}
              </Badge>
              <Button variant="secondary" size="small">
                {type === 'github' ? 'Reconnect' : 'Restart local scan'}
              </Button>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
};

export default IntegrationsCard;
