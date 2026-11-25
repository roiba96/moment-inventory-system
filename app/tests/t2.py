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
        await pg.goto(BASE+"?fake=1"); await pg.wait_for_timeout(300)
        T = lambda: pg.inner_text("#toast")
        await pg.click('[data-a=tab][data-t=more]')
        await pg.fill('#ndName','בית דמו'); await pg.select_option('#ndScale','L'); await pg.click('[data-a=adddes]'); await pg.wait_for_timeout(150)
        # opening stock w/o sizes
        await pg.click('[data-a=tab][data-t=receive]')
        await pg.fill('#rcPaste',"3 תמר\n4 אפרסק"); await pg.click('[data-a=rcparse]')
        await pg.check('[data-a=opentoggle]'); await pg.click('[data-a=confirmrecv]'); await pg.wait_for_timeout(200)
        # month close with per-size grid for תמר
        await pg.click('[data-a=tab][data-t=more]'); await pg.click('[data-a=sub][data-v=close]')
        await pg.locator('[data-a=cxt]').first.click()
        await pg.fill('[data-cs$="|M"]','1'); await pg.fill('[data-cs$="|S"]','1')
        print("row pill:", await pg.inner_text('[id^=cd-] >> nth=0'))
        # אפרסק total mode: counted 3 of 4
        await pg.fill('[data-cc]','3')
        print("summary:", (await pg.inner_text('#clSum')).replace("\n"," | "))
        await pg.click('[data-a=closeapply]'); await pg.wait_for_timeout(300)
        print("toast:", await T())
        st = await pg.evaluate("""() => P.map(p => p.name + ': ' + SZ.filter(z => stockSize(p.id, z)).map(z => (z||'ללא') + '=' + stockSize(p.id, z)).join(',') + ' (סה״כ ' + stock(p.id) + ')')""")
        print("stock:", st)
        await pg.click('[data-a=sub][data-v=report]')
        print("report sold list:", (await pg.inner_text('#view'))[-140:].replace("\n"," | "))
        # persistence parity
        n = await pg.evaluate("[Object.keys(__sdk._data.moves).length, M.length, Object.keys(__sdk._data.products).length, P.length, Object.keys(__sdk._data.designers).length]")
        print("persisted vs local (moves, products, designers):", n)
        # undo receipt / cancel & sale cap in real mode
        await pg.click('[data-a=tab][data-t=sell]'); await pg.fill('#sellQ','תמר'); await pg.click('[data-a=open] >> nth=0')
        print("sale chips:", await pg.locator('.sheet .sizebtn .sl').all_inner_texts(), await pg.locator('.sheet .sizebtn .st').all_inner_texts())
        print("errors:", errs)
        await b.close()
asyncio.run(main())
