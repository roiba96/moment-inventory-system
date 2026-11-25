import asyncio
from playwright.async_api import async_playwright
from pathlib import Path
HERE=Path(__file__).resolve().parent
BASE=(HERE.parent/"dist"/"moment-app.html").as_uri()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs=[]
        pg = await b.new_page(viewport={"width":400,"height":820})
        pg.on("pageerror", lambda e: errs.append("PAGEERR "+str(e)))
        await pg.route("**/fonts.googleapis.com/**", lambda r: r.abort())
        await pg.goto(BASE+"?demo=1"); await pg.wait_for_timeout(600)
        print("badge:", await pg.inner_text("#connBadge"), "| sub:", (await pg.inner_text("#subLine"))[:50])
        print("home:", (await pg.inner_text(".tiles")).replace("\n"," "))
        await pg.click('[data-a=tab][data-t=sell]'); await pg.click('[data-a=open] >> nth=0')
        print("money price field in demo:", await pg.locator('#sheetPrice').count())
        await pg.click('.sheet button[data-a=closesheet]')
        await pg.click('[data-a=tab][data-t=more]'); await pg.click('[data-a=sub][data-v=report]')
        print("report has payout:", "סה״כ לתשלום" in await pg.inner_text('#view'))
        await pg.click('[data-a=sub][data-v=designers]')
        print("designers:", await pg.locator('[data-dn]').count(), "mult fields:", await pg.locator('[data-dm]').count())
        print("overflow:", await pg.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth"), "errors:", errs)
        await b.close()
asyncio.run(main())
