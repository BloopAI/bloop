import React, {
  ChangeEvent,
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useTranslation, Trans } from 'react-i18next';
import Modal from '../../components/Modal';
import { CloseSignIcon } from '../../icons';
import TextInput from '../TextInput';
import Button from '../Button';
import { UIContext } from '../../context/uiContext';
import { saveBugReport, saveCrashReport } from '../../services/api';
import { DeviceContext } from '../../context/deviceContext';
import { getJsonFromStorage, USER_DATA_FORM } from '../../services/storage';
import { EnvContext } from '../../context/envContext';

type Props = {
  errorBoundaryMessage?: string;
  handleSubmit?: () => void;
  forceShow?: boolean;
};
const ReportBugModal = ({
  errorBoundaryMessage,
  handleSubmit,
  forceShow,
}: Props) => {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    name: '',
    email: '',
    text: '',
    emailError: '',
  });
  const [serverLog, setServerLog] = useState('');
  const [serverCrashedMessage, setServerCrashedMessage] = useState('');
  const { isBugReportModalOpen, setBugReportModalOpen } = useContext(
    UIContext.BugReport,
  );
  const { listen, os, release, invokeTauriCommand } = useContext(DeviceContext);
  const { envConfig } = useContext(EnvContext);

  const userForm = useMemo(
    (): { email: string; firstName: string; lastName: string } | null =>
      getJsonFromStorage(USER_DATA_FORM),
    [],
  );

  useEffect(() => {
    if (isBugReportModalOpen) {
      invokeTauriCommand('get_last_log_file').then((log) => {
        setServerLog(log);
      });
    }
  }, [isBugReportModalOpen]);

  useEffect(() => {
    listen('server-crashed', (event) => {
      console.log(event);
      setBugReportModalOpen(true);
      setServerCrashedMessage(event.payload.message);
    });
  }, [listen]);

  useEffect(() => {
    if (errorBoundaryMessage) {
      setServerCrashedMessage(errorBoundaryMessage);
    }
  }, [errorBoundaryMessage]);

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      name: (userForm?.firstName || '') + (userForm?.lastName || ''),
      email: userForm?.email || '',
    }));
  }, [userForm]);

  const onChange = useCallback(
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setForm((prev) => ({
        ...prev,
        [e.target.name]: e.target.value,
        emailError: e.target.name === 'email' ? '' : prev.emailError,
      }));
    },
    [],
  );

  const onSubmit = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      if (serverCrashedMessage) {
        saveCrashReport({
          text: form.text,
          unique_id: envConfig.tracking_id || '',
          info: serverCrashedMessage,
          metadata: JSON.stringify(os),
          app_version: release,
          server_log: serverLog,
        });
      } else {
        const { emailError, ...values } = form;
        saveBugReport({
          ...values,
          unique_id: envConfig.tracking_id || '',
          app_version: release,
          metadata: JSON.stringify(os),
          server_log: serverLog,
        });
      }
      resetState();
    },
    [form, envConfig.tracking_id, release, serverLog],
  );
  const resetState = useCallback(() => {
    if (serverCrashedMessage) {
      console.log('go to empty page');
    }
    setForm((prev) => ({ ...prev, text: '', emailError: '' }));
    setBugReportModalOpen(false);
    setServerCrashedMessage('');
    handleSubmit?.();
  }, [serverCrashedMessage]);

  return (
    <Modal
      isVisible={isBugReportModalOpen || !!forceShow}
      onClose={() => setBugReportModalOpen(false)}
      containerClassName="max-w-lg max-h-[80vh]"
    >
      <div className="flex flex-col relative bg-bg-shade overflow-auto">
        <div className="flex h-13 px-3 items-center justify-between border-b border-bg-border">
          <p className="title-s select-none text-label-title">
            {serverCrashedMessage ? (
              <Trans>bloop crashed unexpectedly</Trans>
            ) : (
              <Trans>Report a bug</Trans>
            )}
          </p>
          <Button
            onlyIcon
            title={t`Close`}
            variant="tertiary"
            size="small"
            onClick={resetState}
          >
            <CloseSignIcon sizeClassName="w-3.5 h-3.5" />
          </Button>
        </div>
        <div className="flex flex-col p-3 gap-4">
          <p className="select-none body-base text-label-base">
            {serverCrashedMessage ? (
              <Trans>
                By submitting this crash report you agree to send it to bloop
                for investigation.
              </Trans>
            ) : (
              <Trans>
                We want to make this the best experience for you. If you
                encountered a bug, please submit this bug report to us. Our team
                will investigate as soon as possible.
              </Trans>
            )}
          </p>
          <TextInput
            value={form.text}
            onChange={onChange}
            name="text"
            multiline
            placeholder={t`Provide any steps necessary to reproduce the problem...`}
          />
          {!!serverCrashedMessage && (
            <div>
              <p className="body-s-b text-label-title mb-2">
                <Trans>Problem details and System configuration</Trans>
              </p>
              <p className="body-s-b text-label-title p-3 rounded-6 bg-bg-base overflow-auto">
                {serverCrashedMessage}
                <br />
                <br />
                Type: {os.type}
                <br />
                Platform: {os.platform}
                <br />
                Arch: {os.arch}
                <br />
                Version: {os.version}
                <br />
              </p>
            </div>
          )}
        </div>
        <div className="flex items-center px-3 gap-3 justify-end border-t border-bg-border h-13">
          <Button variant="tertiary" size="small" onClick={resetState}>
            <Trans>Cancel</Trans>
          </Button>
          <Button
            variant="primary"
            size="small"
            onClick={onSubmit}
            disabled={!form.text && !serverCrashedMessage}
          >
            <Trans>Submit bug report</Trans>
          </Button>
        </div>
      </div>
    </Modal>
  );
};

export default memo(ReportBugModal);
