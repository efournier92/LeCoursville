import { ErrorsService } from './errors.service';

describe('ErrorsService', () => {
  it('renders the forced sign-out prompt as a one-action brand info prompt', () => {
    const promptModal = { openDialog: jasmine.createSpy('openDialog') };
    const service = new ErrorsService(
      {} as any,
      { logEvent: jasmine.createSpy('logEvent') } as any,
      promptModal as any,
    );

    (service as any).openErrorDialog();

    expect(promptModal.openDialog).toHaveBeenCalled();
    const buttons = (promptModal.openDialog as any).mock.calls[0][2];
    expect(buttons.length).toBe(1);
    expect(buttons[0]).toEqual(
      jasmine.objectContaining({ label: 'Sign Out', color: 'primary', isConfirmAction: true }),
    );
    expect(buttons[0].destructive).toBeFalsy();
  });
});
