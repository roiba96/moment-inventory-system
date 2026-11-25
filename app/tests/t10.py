import asyncio
from playwright.async_api import async_playwright
from pathlib import Path
HERE=Path(__file__).resolve().parent
BASE=(HERE.parent/"dist"/"moment-app.html").as_uri()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs=[]; dl=[]
        pg = await (await b.new_context(viewport={"width":400,"height":820})).new_page()
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("dialog", lambda d: (dl.append(d.message[:60]), asyncio.ensure_future(d.accept())))
        await pg.route("**/fonts.googleapis.com/**", lambda r: r.abort())
        await pg.goto(BASE+"?fake=1"); await pg.wait_for_timeout(400)
        await pg.click('[data-a=tab][data-t=more]'); await pg.click('[data-a=sub][data-v=designers]')
        for n in ["ריקה","מלאה","נשארת"]:
            await pg.fill('#ndName',n); await pg.click('[data-a=adddes]'); await pg.wait_for_timeout(150)
        await pg.click('[data-a=tab][data-t=receive]'); await pg.select_option('#recvD', index=1)
        await pg.fill('#rcPaste', "2 שמלה\n3 חולצה"); await pg.click('[data-a=rcparse]'); await pg.click('[data-a=confirmrecv]'); await pg.wait_for_timeout(300)
        await pg.select_option('#recvD', index=2)
        await pg.fill('#rcPaste', "1 מכנס"); await pg.click('[data-a=rcparse]'); await pg.click('[data-a=confirmrecv]'); await pg.wait_for_timeout(300)
        cnt = "JSON.stringify(['designers','products','moves'].map(c=>Object.keys(window.__sdk._data[c]||{}).length))"
        print("before:", await pg.evaluate(cnt))
        await pg.click('[data-a=tab][data-t=more]'); await pg.click('[data-a=sub][data-v=designers]')
        await pg.click('[data-a=deldes] >> nth=0'); await pg.wait_for_timeout(300)
        print("after empty delete:", await pg.evaluate(cnt))
        await pg.click('[data-a=deldes] >> nth=0'); await pg.wait_for_timeout(300)
        print("after full delete:", await pg.evaluate(cnt), "dialogs:", dl)
        await pg.click('[data-a=tab][data-t=stock]'); print("stock:", (await pg.inner_text('#view'))[:120].replace("\n"," | "))
        await pg.click('[data-a=tab][data-t=receive]'); await pg.click('[data-a=tab][data-t=sell]'); await pg.click('[data-a=tab][data-t=home]')
        await pg.click('[data-a=tab][data-t=more]'); await pg.click('[data-a=sub][data-v=close]'); await pg.click('[data-a=sub][data-v=report]')
        print("errors:", errs); await b.close()
asyncio.run(main())
