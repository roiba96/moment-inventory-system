import asyncio
from playwright.async_api import async_playwright
from pathlib import Path
HERE=Path(__file__).resolve().parent
BASE=(HERE.parent/"dist"/"moment-app.html").as_uri()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs=[]
        pg = await (await b.new_context(viewport={"width":400,"height":820})).new_page()
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.route("**/fonts.googleapis.com/**", lambda r: r.abort())
        await pg.goto(BASE+"?fake=1"); await pg.wait_for_timeout(400)
        await pg.click('[data-a=tab][data-t=more]'); await pg.click('[data-a=sub][data-v=designers]')
        await pg.fill('#ndName','מעצבת א'); await pg.select_option('#ndScale','N15'); await pg.click('[data-a=adddes]'); await pg.wait_for_timeout(200)
        await pg.click('[data-a=tab][data-t=receive]')
        await pg.fill('#rcPaste', "1\tחולצה נורית — 4\t1\t₪100.00\t₪100.00\n2\tחולצה נורית — 2\t1\t₪100.00\t₪100.00")
        await pg.click('[data-a=rcparse]'); await pg.wait_for_timeout(200); await pg.click('[data-a=confirmrecv]'); await pg.wait_for_timeout(300)
        q = "(z)=>{const ps=window.__sdk._data.products,id=Object.keys(ps)[0];return Object.values(window.__sdk._data.moves).filter(m=>m.p===id&&m.size===z).reduce((s,m)=>s+m.delta,0)}"
        print("before 4/5:", await pg.evaluate(f"({q})('4')"), await pg.evaluate(f"({q})('5')"))
        await pg.click('[data-a=tab][data-t=stock]'); print("stock has open buttons:", await pg.locator('[data-a=open]').count())
        await pg.click('[data-a=tab][data-t=sell]'); await pg.click('[data-a=open] >> nth=0'); await pg.wait_for_timeout(200)
        await pg.click('.sheet summary'); await pg.select_option('#sfFrom','4'); await pg.select_option('#sfTo','5'); await pg.click('[data-a=sizefix]'); await pg.wait_for_timeout(300)
        print("toast:", await pg.inner_text('#toast'))
        print("after 4/5:", await pg.evaluate(f"({q})('4')"), await pg.evaluate(f"({q})('5')"), "sheet open:", await pg.locator('.sheet').count())
        print("errors:", errs); await b.close()
asyncio.run(main())
