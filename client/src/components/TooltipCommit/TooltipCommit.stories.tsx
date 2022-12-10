import TooltipCommit from './index';

export default {
  title: 'components/TooltipCommit',
  component: TooltipCommit,
};

export const TooltipCommitDefault = () => {
  return (
    <div style={{ backgroundColor: '#131315' }}>
      <div className="flex flex-col gap-8 pt-32 items-center">
        <TooltipCommit
          message={'Enable Alex documentation linting for docs (#26598)'}
          name={'Brooklyn Simmons'}
          date={1667220261840}
          image={'/avatar.png'}
          position="left"
        >
          <span>LEFT</span>
        </TooltipCommit>
        <TooltipCommit
          message={'Enable Alex documentation linting for docs (#26598)'}
          name={'Brooklyn Simmons'}
          date={1667220261840}
          image={'/avatar.png'}
          position="right"
        >
          <span>RIGHT</span>
        </TooltipCommit>
        <TooltipCommit
          message={'Enable Alex documentation linting for docs (#26598)'}
          name={'Brooklyn Simmons'}
          date={1667220261840}
          image={'/avatar.png'}
          position="center"
        >
          <span>CENTER</span>
        </TooltipCommit>
      </div>
    </div>
  );
};
