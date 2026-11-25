import asyncio
from playwright.async_api import async_playwright
from pathlib import Path
HERE=Path(__file__).resolve().parent
BASE=(HERE.parent/"dist"/"moment-app.html").as_uri()
Q="(n,z)=>{const ps=window.__sdk._data.products,id=Object.keys(ps).find(k=>ps[k].name===n);return Object.values(window.__sdk._data.moves).filter(m=>m.p===id&&(z===null||m.size===z)).reduce((s,m)=>s+m.delta,0)}"
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs=[]; dl=[]
        pg = await (await b.new_context(viewport={"width":390,"height":844})).new_page()
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("dialog", lambda d: (dl.append(d.message[:40]), asyncio.ensure_future(d.accept())))
        await pg.route("**/fonts.googleapis.com/**", lambda r: r.abort())
        await pg.goto(BASE+"?fake=1"); await pg.wait_for_timeout(400)
        await pg.click('[data-a=tab][data-t=more]'); await pg.click('[data-a=sub][data-v=designers]')
        await pg.fill('#ndName','מעצבת א'); await pg.select_option('#ndScale','N15'); await pg.click('[data-a=adddes]'); await pg.wait_for_timeout(200)
        await pg.fill('#ndName','מעצבת ב'); await pg.click('[data-a=adddes]'); await pg.wait_for_timeout(200)
        # receive for מעצבת א: note with sizes (delivery format) + opening stock without size
        await pg.click('[data-a=tab][data-t=receive]'); await pg.select_option('#recvD', index=0)
        await pg.fill('#rcPaste', "1\tחולצה נורית — 4\t2\t₪100.00\t₪200.00\n2\tחולצה נורית — 5\t1\t₪100.00\t₪100.00\n3\tשמלה דנה\t3\t₪150.00\t₪450.00")
        await pg.click('[data-a=rcparse]'); await pg.click('[data-a=confirmrecv]'); await pg.wait_for_timeout(300)
        print("receipts list still shows:", await pg.locator('[data-a=cancelrecv]').count())
        # return mode
        await pg.click('[data-a=rmode][data-v=ret]'); await pg.wait_for_timeout(200)
        await pg.fill('#rtPaste', "1\tחולצה נורית — 4\t1\t₪100.00\t₪100.00\n2\tשמלה דנה — 3\t2\t₪150.00\t₪300.00\n3\tמכנס לא קיים\t1\t₪90.00\t₪90.00")
        await pg.click('[data-a=rtparse]'); await pg.wait_for_timeout(200)
        print("parse msg:", (await pg.inner_text('.card:has(#rtPaste)')).replace("\n"," | ")[-220:])
        # try over-return: add more of size 4 (has 2, returning 1 -> can add 1 more, then blocked)
        await pg.click('[data-a=rtsz][data-i="0"][data-s="4"]'); await pg.wait_for_timeout(100)
        await pg.click('[data-a=rtsz][data-i="0"][data-s="4"]'); await pg.wait_for_timeout(100)
        print("toast over:", await pg.inner_text('#toast'))
        await pg.fill('#rtDate','2026-11-05')
        await pg.click('[data-a=rtconfirm]'); await pg.wait_for_timeout(300)
        print("toast:", await pg.inner_text('#toast'))
        print("נורית size4:", await pg.evaluate(f"({Q})('חולצה נורית','4')"), "dana total:", await pg.evaluate(f"({Q})('שמלה דנה',null)"), "dana nosize:", await pg.evaluate(f"({Q})('שמלה דנה','')"))
        print("return moves dates:", await pg.evaluate("[...new Set(Object.values(window.__sdk._data.moves).filter(m=>m.type==='return').map(m=>m.date+'/'+m.size+'/'+m.delta))]"))
        print("recent returns:", await pg.locator('[data-a=rtcancel]').count())
        # report shows returned
        await pg.click('[data-a=tab][data-t=more]'); await pg.click('[data-a=sub][data-v=report]'); await pg.wait_for_timeout(200)
        print("report:", (await pg.inner_text('#view'))[:400].replace("\n"," | "))
        # cancel return
        await pg.click('[data-a=tab][data-t=receive]'); await pg.wait_for_timeout(100)
        await pg.click('[data-a=rtcancel] >> nth=0'); await pg.wait_for_timeout(300)
        print("after cancel dana:", await pg.evaluate(f"({Q})('שמלה דנה',null)"), "dialogs:", dl)
        await pg.click('[data-a=rmode][data-v=recv]'); await pg.wait_for_timeout(100); print("back to recv has paste:", await pg.locator('#rcPaste').count())
        print("errors:", errs); await b.close()
asyncio.run(main())
