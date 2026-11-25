import asyncio
from playwright.async_api import async_playwright
from pathlib import Path
HERE=Path(__file__).resolve().parent
BASE=(HERE.parent/"dist"/"moment-app.html").as_uri()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs=[]; dl=[]
        pg = await (await b.new_context(viewport={"width":390,"height":844})).new_page()
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("dialog", lambda d: (dl.append(d.message[:30]), asyncio.ensure_future(d.accept())))
        await pg.route("**/fonts.googleapis.com/**", lambda r: r.abort())
        await pg.goto(BASE+"?fake=1"); await pg.wait_for_timeout(400)
        await pg.click('[data-a=tab][data-t=more]'); await pg.click('[data-a=sub][data-v=designers]')
        for n in ["מעצבת א","מעצבת ב"]:
            await pg.fill('#ndName',n); await pg.select_option('#ndScale','N15'); await pg.click('[data-a=adddes]'); await pg.wait_for_timeout(150)
        await pg.click('[data-a=tab][data-t=receive]'); await pg.select_option('#recvD', index=0)
        await pg.fill('#rcPaste', "1\tחולצה נורית — 4\t2\t₪100.00\t₪200.00\n2\tשמלה דנה\t3\t₪150.00\t₪450.00"); await pg.click('[data-a=rcparse]'); await pg.click('[data-a=confirmrecv]'); await pg.wait_for_timeout(300)
        await pg.select_option('#recvD', index=1)
        await pg.fill('#rcPaste', "7001\n70003*2"); await pg.click('[data-a=rcparse]'); await pg.click('[data-a=confirmrecv]'); await pg.wait_for_timeout(300)
        await pg.click('[data-a=rmode][data-v=ret]'); await pg.select_option('#rtD', index=0); await pg.wait_for_timeout(100)
        await pg.fill('#rtPaste', "שמלה דנה x 1"); await pg.click('[data-a=rtparse]'); await pg.click('[data-a=rtconfirm]'); await pg.wait_for_timeout(300)
        # a sale
        await pg.click('[data-a=tab][data-t=sell]'); await pg.click('[data-a=open] >> nth=0'); await pg.click('.sheet .sizebtn:not(.none) >> nth=0'); await pg.click('.sheet [data-a=sell]'); await pg.wait_for_timeout(300)
        # history
        await pg.click('[data-a=tab][data-t=more]'); await pg.click('[data-a=sub][data-v=history]'); await pg.wait_for_timeout(200)
        print("tiles:", (await pg.inner_text('.tiles')).replace("\n"," "))
        print("cards:", await pg.locator('[data-a=hopen]').count(), [x.replace("\n"," ") for x in await pg.locator('[data-a=hopen]').all_inner_texts()])
        await pg.click('[data-a=hopen] >> nth=0'); await pg.wait_for_timeout(150)
        await pg.click('[data-a=hset][data-k=type][data-v=receive]'); await pg.wait_for_timeout(150); print("receive only:", await pg.locator('[data-a=hopen]').count())
        await pg.select_option('#hD', index=2); await pg.wait_for_timeout(150); print("מעצבת ב receive:", [x.replace("\n"," ") for x in await pg.locator('[data-a=hopen]').all_inner_texts()])
        await pg.click('[data-a=hopen] >> nth=0'); await pg.wait_for_timeout(150); print("lines:", (await pg.inner_text('#view'))[-160:].replace("\n"," | "))
        await pg.click('[data-a=hset][data-k=range][data-v=yesterday]'); await pg.wait_for_timeout(150); print("yesterday empty:", "אין פעולות" in await pg.inner_text('#view'))
        await pg.click('[data-a=hset][data-k=range][data-v=custom]'); await pg.wait_for_timeout(150); print("custom has dates:", await pg.locator('#hFrom').count(), "cards:", await pg.locator('[data-a=hopen]').count())
        # cancel return from history
        await pg.select_option('#hD', index=0); await pg.click('[data-a=hset][data-k=type][data-v=return]'); await pg.wait_for_timeout(150)
        await pg.click('[data-a=hopen] >> nth=0'); await pg.wait_for_timeout(150)
        before = await pg.evaluate("Object.values(window.__sdk._data.moves).filter(m=>m.type==='return').length")
        await pg.click('[data-a=rtcancel]'); await pg.wait_for_timeout(300)
        after = await pg.evaluate("Object.values(window.__sdk._data.moves).filter(m=>m.type==='return').length")
        print("return cancel from history:", before, "->", after, "| still on history:", await pg.locator('[data-a=hset]').count() > 0)
        print("dialogs:", dl, "errors:", errs); await b.close()
asyncio.run(main())
