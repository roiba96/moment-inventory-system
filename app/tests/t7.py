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
        await pg.check('[data-dsc$="|OS"]'); await pg.wait_for_timeout(200)
        print("designer sizes:", (await pg.inner_text('.card:has([data-dn])')).split("המידות במכירה ובקליטה:")[1].split("\n")[0])
        print("stored scale:", await pg.evaluate("Object.values(window.__sdk._data.designers)[0].scale"))
        # uncheck all but one -> cannot leave empty
        await pg.uncheck('[data-dsc$="|N15"]'); await pg.wait_for_timeout(100)
        await pg.click('[data-dsc$="|OS"]'); await pg.wait_for_timeout(100)
        print("after trying to empty:", await pg.evaluate("Object.values(window.__sdk._data.designers)[0].scale"))
        await pg.check('[data-dsc$="|N15"]'); await pg.wait_for_timeout(100)
        # receive 24-item list in mixed formats
        lst = "יבוא לדוגמה מלאי 1.11\n" + "\n".join(["3 שמלה מאיה","גולף x 2","חולצה כפתורים 4","2x מכנס","טוניקה","סריג 1","קרדיגן 3","וסט","2 חצאית","ז'קט x 2","שמלה 'נוי' 2","טופ"])
        await pg.click('[data-a=tab][data-t=receive]')
        await pg.fill('#rcPaste', lst); await pg.click('[data-a=rcparse]'); await pg.wait_for_timeout(200)
        print("parse note:", (await pg.inner_text('.card:has(#rcPaste)')).replace("\n"," | ")[-200:])
        await pg.check('[data-a=opentoggle]'); await pg.click('[data-a=confirmrecv]'); await pg.wait_for_timeout(300)
        print("toast:", await pg.inner_text('#toast'))
        print("units stored:", await pg.evaluate("Object.values(window.__sdk._data.moves).reduce((s,m)=>s+m.delta,0)"))
        await pg.click('[data-a=tab][data-t=home]'); print("home:", (await pg.inner_text('.tiles')).replace("\n"," "))
        await pg.click('[data-a=tab][data-t=stock]'); print("stock top:", (await pg.inner_text('#view'))[:160].replace("\n"," | "))
        await pg.click('[data-a=tab][data-t=sell]'); await pg.click('[data-a=open] >> nth=0'); await pg.wait_for_timeout(200)
        print("sale size buttons:", await pg.locator('.sheet .sizebtn').all_inner_texts())
        print("errors:", errs); await b.close()
asyncio.run(main())
