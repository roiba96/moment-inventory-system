import asyncio
from playwright.async_api import async_playwright
from pathlib import Path
HERE=Path(__file__).resolve().parent
BASE=(HERE.parent/"dist"/"moment-app.html").as_uri()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs=[]
        ctx = await b.new_context(viewport={"width":400,"height":820})
        pg = await ctx.new_page()
        pg.on("pageerror", lambda e: errs.append(str(e)))
        dialogs=[]
        pg.on("dialog", lambda dlg: (dialogs.append(dlg.message), asyncio.ensure_future(dlg.dismiss())))
        await pg.route("**/fonts.googleapis.com/**", lambda r: r.abort())
        await pg.goto(BASE+"?fake=1"); await pg.wait_for_timeout(400)
        await pg.click('[data-a=tab][data-t=more]'); await pg.click('[data-a=sub][data-v=designers]')
        await pg.fill('#ndName','בדיקה'); await pg.click('[data-a=adddes]'); await pg.wait_for_timeout(200)
        await pg.click('[data-a=tab][data-t=receive]')
        await pg.fill('#rcPaste', "בדיקה מלאי 1.11\n" + "\n".join("2 דגם %d"%i for i in range(60)))
        await pg.click('[data-a=rcparse]'); await pg.check('[data-a=opentoggle]'); await pg.click('[data-a=confirmrecv]'); await pg.wait_for_timeout(500)
        n = await pg.evaluate("Object.keys(window.__sdk._data.products||{}).length")
        u = await pg.evaluate("Object.values(window.__sdk._data.moves||{}).reduce((s,m)=>s+m.delta,0)")
        print("60 models -> products stored:", n, "units:", u)
        # count draft survives reload (localStorage)
        await pg.click('[data-a=tab][data-t=more]'); await pg.click('[data-a=sub][data-v=close]')
        await pg.fill('[data-cc] >> nth=0', '1'); await pg.wait_for_timeout(100)
        d = await pg.evaluate("localStorage.getItem('moment-close-draft')")
        print("draft saved:", d is not None and '"1"' in d)
        # close twice -> second time prompts
        await pg.click('[data-a=closeapply]'); await pg.wait_for_timeout(300)
        closes = await pg.evaluate("Object.keys(window.__sdk._data.settings||{}).filter(k=>k.startsWith('close_')).length")
        sales = await pg.evaluate("Object.values(window.__sdk._data.moves||{}).filter(m=>m.type==='sale').length")
        print("close record:", closes, "sales after close:", sales)
        await pg.fill('[data-cc] >> nth=1', '0'); await pg.click('[data-a=closeapply]'); await pg.wait_for_timeout(300)
        sales2 = await pg.evaluate("Object.values(window.__sdk._data.moves||{}).filter(m=>m.type==='sale').length")
        print("second close prompted:", len(dialogs)>0, "dismissed -> sales unchanged:", sales2==sales)
        print("errors:", errs)
        await b.close()
asyncio.run(main())
