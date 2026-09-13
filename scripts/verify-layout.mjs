import { chromium, expect } from '@playwright/test';
const browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}});
await page.goto('http://127.0.0.1:5173');
await page.getByRole('button',{name:'Create a new room',exact:true}).click();
for(const tab of ['Design','Library','Rays','Measure','Saves','Files']){
 await page.getByRole('button',{name:tab,exact:true}).click();
 await expect(page.getByRole('button',{name:tab,exact:true})).toHaveAttribute('aria-pressed','true');
}
await page.getByRole('button',{name:'Design',exact:true}).click();
await page.locator('summary').first().click();
await expect(page.locator('details').first()).not.toHaveAttribute('open','');
await page.locator('summary').first().click();
await page.getByRole('button',{name:'Collapse editing panel'}).click();
await page.getByRole('button',{name:'Expand editing panel'}).click();
await expect(page.getByRole('button',{name:'Add objects',exact:true})).toBeVisible();
await page.getByRole('button',{name:'Toggle light and dark mode'}).click();
await page.screenshot({path:'/tmp/acoustic-v12-light.png'});
await page.setViewportSize({width:680,height:1000});
await page.screenshot({path:'/tmp/acoustic-v12-narrow.png'});
const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
if(overflow) throw Error('Page overflows narrow viewport');
await page.getByRole('button',{name:'Files',exact:true}).click();
await expect(page.getByRole('button',{name:'Import JSON',exact:true})).toBeAttached();
await browser.close();
console.log('PASS: all six tabs, section collapse, panel collapse/expand, light mode, narrow viewport and import access.');
