import { AppChat } from './chat.po';
import { browser, by, element, logging } from 'protractor';

describe('workspace-project App', () => {
  let chat: AppChat;

  beforeEach(() => {
    chat = new AppChat();
  });

  it('should display the toolbar colored as theme primary', async () => {
    await chat.navigateTo();
    
    const toolbar = await chat.getToolbarMaterialColor();
    expect(toolbar).toEqual('primary');
  });

  it('should include a Chat component', async () => {
    await chat.navigateTo();
    
    const isChatComponentPresent = await chat.isChatComponentPresent();

    expect(isChatComponentPresent).toBeTruthy();
  });

  it('should include a "New Message" button', async () => {
    await chat.navigateTo();
    
    const isCreateMessageButtonPresent = await chat.isCreateMessageButtonPresent();

    expect(isCreateMessageButtonPresent).toBeTruthy();
  });

  it('should create a new message on clicking the "New Message" button', async () => {
    await chat.navigateTo();
        
    await chat.clickNewMessageButton();

    await chat.inputToNewMessageTitleInput();
    await chat.inputToNewMessageBodyInput();

    const isNewMessageContentPresent = await chat.isNewMessageContentPresent();
    await chat.clickSaveButton();

    await chat.clickConfirmButton();
    
    debugger;

    expect(isNewMessageContentPresent).toBeTruthy();
  });  
  

  afterEach(async () => {
    // Assert that there are no errors emitted from the browser
    const logs = await browser.manage().logs().get(logging.Type.BROWSER);
    expect(logs).not.toContain(jasmine.objectContaining({
      level: logging.Level.SEVERE,
    } as logging.Entry));
  });
});
