import React, { useCallback, useContext, useEffect, useState } from 'react';
import TextInput from '../../../../components/TextInput';
import Button from '../../../../components/Button';
import { ArrowRight } from '../../../../icons';
import DialogText from '../DialogText';
import { UIContext } from '../../../../context/uiContext';
import { saveUserData } from '../../../../services/api';
import { DeviceContext } from '../../../../context/deviceContext';
import { EMAIL_REGEX } from '../../../../consts/validations';

type Form = {
  firstName: string;
  lastName: string;
  email: string;
  emailError: string | null;
};

type Props = {
  handleNext: (e?: any) => void;
};

const STEP_KEY = 'STEP_0';
const Step0 = ({ handleNext }: Props) => {
  const [form, setForm] = useState<Form>({
    firstName: '',
    lastName: '',
    email: '',
    emailError: null,
  });
  const { onBoardingState, setOnBoardingState } = useContext(UIContext);
  const { deviceId } = useContext(DeviceContext);

  useEffect(() => {
    const savedForm = onBoardingState[STEP_KEY];

    setForm({
      firstName: savedForm?.firstName || '',
      email: savedForm?.email || '',
      lastName: savedForm?.lastName || '',
      emailError: savedForm?.emailError || null,
    });
  }, []);

  const handleSubmit = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      if (!form.emailError) {
        saveUserData({
          email: form.email,
          first_name: form.firstName,
          last_name: form.lastName,
          unique_id: deviceId,
        });
        handleNext();
      }
    },
    [form, deviceId],
  );

  const handleSkip = useCallback(
    (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      e.preventDefault();
      handleNext();
    },
    [],
  );

  useEffect(() => {
    if (form.email || form.firstName || form.lastName) {
      setOnBoardingState((prev) => ({
        ...prev,
        [STEP_KEY]: form,
      }));
    }
  }, [form]);

  return (
    <>
      <DialogText
        title="Setup bloop"
        description="Tell us a little bit more about yourself. We are using this
          information to learn more about our users in the Beta release. We
          might use your email to let you know when the full version of the app
          is released"
        isCentered={false}
      />
      <form className="flex flex-col gap-4">
        <TextInput
          value={form.firstName}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, firstName: e.target.value }))
          }
          name="firstName"
          placeholder="First name"
        />
        <TextInput
          value={form.lastName}
          onChange={(e) =>
            setForm((prev) => ({ ...prev, lastName: e.target.value }))
          }
          name="lastName"
          placeholder="Last name"
        />
        <TextInput
          value={form.email}
          onChange={(e) =>
            setForm((prev) => ({
              ...prev,
              email: e.target.value,
              emailError: null,
            }))
          }
          validate={() => {
            if (!EMAIL_REGEX.test(form.email)) {
              setForm((prev) => ({
                ...prev,
                emailError: 'Email is not valid',
              }));
            }
          }}
          error={form.emailError}
          name="email"
          placeholder="Email address"
        />
        <div className="flex flex-col gap-4 mt-4">
          <Button
            type="submit"
            variant="primary"
            onClick={handleSubmit}
            disabled={!!form.emailError}
          >
            Submit
          </Button>
          <Button variant="secondary" onClick={handleSkip}>
            Skip this step
            <ArrowRight />
          </Button>
        </div>
      </form>
    </>
  );
};

export default Step0;
