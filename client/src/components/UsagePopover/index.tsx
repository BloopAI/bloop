import { memo, useCallback, useContext, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { PersonalQuotaContext } from '../../context/personalQuotaContext';
import Button from '../Button';
import { DoubleChevronInIcon, DoubleChevronOutIcon } from '../../icons';
import Tooltip from '../Tooltip';
import { SettingSections } from '../../types/general';
import { UIContext } from '../../context/uiContext';
import UsageIcon from './UsageIcon';

type Props = {};

const UsagePopover = ({}: Props) => {
  const { t } = useTranslation();
  const { quota, isSubscribed, resetAt, hasCheckedQuota } = useContext(
    PersonalQuotaContext.Values,
  );
  const { setSettingsSection, setSettingsOpen } = useContext(
    UIContext.Settings,
  );
  const [isExpanded, setIsExpanded] = useState(true);

  const handleToggle = useCallback(() => {
    setIsExpanded((prev) => !prev);
  }, []);

  const onUpgradeClick = useCallback(() => {
    setSettingsSection(SettingSections.SUBSCRIPTION);
    setSettingsOpen(true);
  }, []);

  return !hasCheckedQuota || isSubscribed ? null : (
    <div className="absolute bottom-0 left-0 right-0 p-2">
      <div className="flex flex-col items-start gap-2.5 p-2.5 mx-auto w-full max-w-[16.875rem] rounded-md border border-bg-border bg-bg-base shadow-high select-none">
        <div className="w-full flex items-center gap-2 text-label-muted">
          <UsageIcon
            percent={(quota.used / quota.allowed) * 100}
            sizeClassName="w-4 h-4"
          />
          <p
            className={`body-s-b flex-1 ${
              quota.used >= quota.allowed ? 'text-red' : 'text-label-title'
            }`}
          >
            <Trans>
              {quota.used >= quota.allowed ? 'Usage exceeded' : 'Usage status'}
            </Trans>
          </p>
          <Button
            variant="tertiary"
            size="mini"
            onlyIcon
            onClick={handleToggle}
            title={t(isExpanded ? 'Collapse' : 'Expand')}
          >
            {isExpanded ? (
              <DoubleChevronInIcon sizeClassName="w-3.5 h-3.5" />
            ) : (
              <DoubleChevronOutIcon sizeClassName="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
        {isExpanded && (
          <>
            <div className="w-full flex flex-col gap-1">
              <div className="flex gap-1 items-center">
                <Tooltip
                  text={
                    <span className="max-w-[13.5rem]">
                      {t(
                        'The amount of times you can generate responses in Studio conversations.',
                      )}
                    </span>
                  }
                  placement={'top-start'}
                  variant="standard"
                  appendTo="parent"
                >
                  <div className="h-5 px-1.5 flex items-center justify-center rounded-full hover:bg-bg-base-hover border border-bg-border body-tiny text-label-title">
                    {quota.used} <span className="text-label-muted">/</span>{' '}
                    {quota.allowed}
                  </div>
                </Tooltip>
                <span className="body-mini">
                  <Trans>Studio requests</Trans>
                </span>
              </div>
            </div>
            <div className="w-full flex items-center justify-between gap-1">
              <span className="text-label-title body-mini">
                {quota.used >= quota.allowed ? (
                  <>
                    <Trans>Usage resets at</Trans>{' '}
                    {format(new Date(resetAt), 'dd/MM hh:mm')}
                  </>
                ) : null}
              </span>
              <Button size="mini" onClick={onUpgradeClick}>
                <Trans>Upgrade</Trans>
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default memo(UsagePopover);
