import asyncio
from playwright.async_api import async_playwright
from pathlib import Path
HERE=Path(__file__).resolve().parent
BASE=(HERE.parent/"dist"/"moment-app.html").as_uri()
LST="7001\n7002\n‏70003*2\n‏7004\n‏7005*3 \n‏ 7006*2\n‏7007*2 \n‏700008\n‏700009\n‏700010\n‏711\n‏712*2\n‏713*2\n‏7014\n‏7015\n700016"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs=[]
        pg = await (await b.new_context(viewport={"width":400,"height":820})).new_page()
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.route("**/fonts.googleapis.com/**", lambda r: r.abort())
        await pg.goto(BASE+"?fake=1"); await pg.wait_for_timeout(400)
        await pg.click('[data-a=tab][data-t=more]'); await pg.click('[data-a=sub][data-v=designers]')
        await pg.fill('#ndName','יבוא לדוגמה'); await pg.click('[data-a=adddes]'); await pg.wait_for_timeout(200)
        await pg.click('[data-a=tab][data-t=receive]')
        await pg.fill('#rcPaste', LST); await pg.click('[data-a=rcparse]'); await pg.check('[data-a=opentoggle]'); await pg.click('[data-a=confirmrecv]'); await pg.wait_for_timeout(300)
        print("toast:", await pg.inner_text('#toast'))
        print("70003 qty:", await pg.evaluate("(()=>{const ps=window.__sdk._data.products, id=Object.keys(ps).find(k=>ps[k].name==='70003'); return Object.values(window.__sdk._data.moves).filter(m=>m.p===id).reduce((s,m)=>s+m.delta,0)})()"))
        print("errors:", errs); await b.close()
asyncio.run(main())
