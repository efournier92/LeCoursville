import { browser, by, element, ElementArrayFinder } from 'protractor';

export class AppChat {
  navigateTo(): Promise<unknown> {
    return browser.get(browser.baseUrl + "/chat") as Promise<unknown>;
  }

  getTitleText(): Promise<string> {
    return element(by.css('app-root .content span')).getText() as Promise<string>;
  }

  getToolbarMaterialColor(): Promise<string> {
    return element(by.css('.mat-toolbar')).getAttribute('ng-reflect-color') as Promise<string>;
  }

  getToolbarIconSrc(): Promise<string> {
    return element(by.css('.mat-toolbar img')).getAttribute('src') as Promise<string>;
  }

  inputText(css: string, input: string): Promise<void> {
    return element(by.css(css)).sendKeys(input) as Promise<void>;
  }

  clickButton(css: string): Promise<void> {
    return element(by.css(css)).click() as Promise<void>;
  }

  getCurrentUrl(): Promise<string> {
    return browser.getCurrentUrl() as Promise<string>
  }

  async doesToolbarIncludeAnyRoutes(): Promise<boolean> {
    let isInlinePresent = await this.doesToolbarIncludeRoutesInline();
    let isMenuPresent = await this.doesToolbarIncludeRoutesMenu();

    return isInlinePresent || isMenuPresent;
  }

  doesToolbarIncludeRoutesInline(): Promise<boolean> {
    return element(by.className('toolbar-routes-buttons-inline')).isPresent() as Promise<boolean>;
  }

  doesToolbarIncludeRoutesMenu(): Promise<boolean> {
    return element(by.css('toolbar-routes-menu')).isPresent() as Promise<boolean>;
  }

  async login() {
    this.navigateTo();
    await this.inputText("firebase-ui input", "efournier92@gmail.com");
    await this.clickButton("firebase-ui button");
    await browser.sleep(1000)
    await this.inputText("firebase-ui .firebaseui-id-password", "bashLec#Electric0");
    await this.clickButton("firebase-ui button");

    // const currentUrl = await this.getCurrentUrl();
    // return expect(currentUrl).toContain("chat") as Promise<unknown>;
  }

  isChatComponentPresent(): Promise<boolean> {
    return element(by.className('chat-component')).isPresent() as Promise<boolean>;
  }

  isCreateMessageButtonPresent(): Promise<boolean> {
    return element(by.css('.chat-component .create-message-button')).isPresent() as Promise<boolean>;
  }

  clickNewMessageButton(): Promise<void> {
    return element(by.css('.chat-component .create-message-button')).click() as Promise<void>;
  }

  isNewMessageTitleInputPresent(): Promise<boolean> {
    return element(by.css('.chat-edit-component')).isPresent() as Promise<boolean>;
  }

  isNewMessageTitleMessage(): Promise<boolean> {
    return element(by.css('.chat-edit-component')).isPresent() as Promise<boolean>;
  }

  newMessageTitleContent: string = "Test Title";
  newMessageBodyContent: string = "Test Body";

  inputToNewMessageTitleInput(): Promise<void> {
    return element(by.css('.chat-edit-input-title')).sendKeys(this.newMessageTitleContent) as Promise<void>;
  }

  inputToNewMessageBodyInput(): Promise<void> {
    return element(by.css('.chat-edit-input-body')).sendKeys(this.newMessageBodyContent) as Promise<void>;
  }

  getNewMessageTitleContent(): Promise<string> {
    return element(by.css('.chat-edit-input-title')).getAttribute('ng-reflect-model') as Promise<string>;
  }

  getNewMessageBodyContent(): Promise<string> {
    return element(by.css('.chat-edit-input-body')).getAttribute('ng-reflect-model') as Promise<string>;
  }

  async isNewMessageContentPresent(): Promise<boolean> {
    const newMessageTitle = await this.getNewMessageTitleContent();
    const newMessageBody = await this.getNewMessageBodyContent();
    
    return newMessageTitle == this.newMessageTitleContent && newMessageBody == this.newMessageBodyContent;
  }

  clickSaveButton(): Promise<void> {
    return element(by.css('.chat-edit-button-send')).click() as Promise<void>;
  }

  clickConfirmButton(): Promise<void> {
    return element(by.css('.confirm-prompt-confirm-button')).click() as Promise<void>;
  }

}
