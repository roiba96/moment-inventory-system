import asyncio
from playwright.async_api import async_playwright
from pathlib import Path
HERE=Path(__file__).resolve().parent
BASE=(HERE.parent/"dist"/"moment-app.html").as_uri()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs=[]
        ctx = await b.new_context(viewport={"width":390,"height":844}); pg = await ctx.new_page()
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.route("**/fonts.googleapis.com/**", lambda r: r.abort())
        await pg.goto(BASE+"?demo=1"); await pg.wait_for_timeout(700)
        await pg.click('[data-a=tab][data-t=stock]'); await pg.wait_for_timeout(300)
        print("open groups default:", await pg.locator('details.grp[open]').count(), "of", await pg.locator('details.grp').count())
        await pg.click('details.grp >> nth=1 >> summary'); await pg.wait_for_timeout(300)
        print("after open one:", await pg.locator('details.grp[open]').count(), "btn:", await pg.inner_text('[data-a=grpall]'))
        await pg.reload(); await pg.wait_for_timeout(700); await pg.click('[data-a=tab][data-t=stock]'); await pg.wait_for_timeout(300)
        print("after reload remembered:", await pg.locator('details.grp[open]').count())
        await pg.click('[data-a=grpall]'); await pg.wait_for_timeout(200); print("open all:", await pg.locator('details.grp[open]').count())
        await pg.click('[data-a=grpall]'); await pg.wait_for_timeout(200); print("close all:", await pg.locator('details.grp[open]').count())
        await pg.fill('#invQ','גולף'); await pg.wait_for_timeout(300); print("search opens:", await pg.locator('details.grp[open]').count(), await pg.locator('details.grp').count())
        await pg.fill('#invQ',''); await pg.wait_for_timeout(200)
        await pg.click('[data-a=counttoggle]'); await pg.wait_for_timeout(200); print("count mode groups:", await pg.locator('details.grp').count())
        await pg.wait_for_timeout(500); print("errors:", errs)
        await b.close()
asyncio.run(main())
