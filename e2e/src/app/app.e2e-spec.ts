import { AppPage } from './app.po';
import { browser, logging } from 'protractor';

describe('workspace-project App', () => {
  let page: AppPage;

  beforeEach(() => {
    page = new AppPage();
  });

  it('should display the toolbar colored as theme primary', async () => {
    await page.navigateTo();
    
    var toolbar = await page.getToolbarMaterialColor();
    
    expect(toolbar).toEqual('primary');
  });

  it('should display include an icon', async () => {
    await page.navigateTo();
    
    var icon = await page.getToolbarIconSrc();
    expect(icon).toContain('assets/img');
  });

  it('should hide buttons for unrecognized users', async () => {
    await page.navigateTo();
    
    var areButtonsDisplayed = await page.doesToolbarIncludeAnyRoutes();

    expect(areButtonsDisplayed).toBeFalsy();
  });

  it('should allow the user to log in and land them on the chat page', async () => {
    await page.navigateTo();
    await page.login();
 
    const currentUrl = await page.getCurrentUrl();

    expect(currentUrl).toContain("chat");
  });

  afterEach(async () => {
    // Assert that there are no errors emitted from the browser
    const logs = await browser.manage().logs().get(logging.Type.BROWSER);
    expect(logs).not.toContain(jasmine.objectContaining({
      level: logging.Level.SEVERE,
    } as logging.Entry));
  });
});
