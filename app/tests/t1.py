import asyncio, sys
from playwright.async_api import async_playwright
from pathlib import Path
HERE=Path(__file__).resolve().parent
BASE=(HERE.parent/"dist"/"moment-app.html").as_uri()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        errs=[]
        async def mk(url):
            pg = await b.new_page(viewport={"width":400,"height":820})
            pg.on("pageerror", lambda e: errs.append("PAGEERR "+str(e)))
            pg.on("console", lambda m: errs.append(m.text) if m.type=="error" and "ERR_TUNNEL" not in m.text and "Failed to load resource" not in m.text else None)
            await pg.route("**/fonts.googleapis.com/**", lambda r: r.abort())
            await pg.goto(url); await pg.wait_for_timeout(400)
            return pg
        # 1. signed out gate
        pg = await mk(BASE+"?fake=1&signedout=1")
        print("gate:", (await pg.inner_text("#view")).replace("\n"," | "))
        await pg.click('[data-a=signin]'); await pg.wait_for_timeout(400)
        print("after signin tabs visible:", await pg.locator("nav.tabs").is_visible(), "| home:", (await pg.inner_text("#view"))[:80].replace("\n"," | "))
        await pg.close()
        # 2. empty fake store: onboarding
        pg = await mk(BASE+"?fake=1")
        print("empty home:", (await pg.inner_text("#view"))[:60].replace("\n"," | "), "| badge:", await pg.inner_text("#connBadge"))
        # add designer
        await pg.click('[data-a=tab][data-t=more]'); await pg.click('[data-a=sub][data-v=designers]')
        await pg.fill('#ndName','בית דמו'); await pg.select_option('#ndScale','L'); await pg.click('[data-a=adddes]'); await pg.wait_for_timeout(200)
        await pg.fill('#ndName','מותג דמו'); await pg.select_option('#ndScale','N'); await pg.click('[data-a=adddes]'); await pg.wait_for_timeout(200)
        print("designers:", await pg.locator('[data-dn]').count(), "| mult field visible (money off):", await pg.locator('[data-dm]').count())
        # opening stock via paste (designer 1)
        await pg.click('[data-a=tab][data-t=receive]')
        await pg.select_option('#recvD', index=0)
        await pg.fill('#rcPaste', "בית דמו מלאי 1.9\n3 x תמר\nאפרסק x 4\n2 שקד\nגפן")
        await pg.click('[data-a=rcparse]'); await pg.wait_for_timeout(200)
        print("parse:", (await pg.inner_text('.card:has(#rcPaste)')).replace("\n"," | ")[-230:])
        print("lines:", await pg.locator('.rline').count())
        await pg.check('[data-a=opentoggle]')
        await pg.click('[data-a=confirmrecv]'); await pg.wait_for_timeout(300)
        print("toast:", await pg.inner_text('#toast'))
        # stock
        await pg.click('[data-a=tab][data-t=stock]')
        print("stock tiles:", (await pg.inner_text('.tiles')).replace("\n"," "))
        # delivery note for designer 2
        await pg.click('[data-a=tab][data-t=receive]')
        await pg.select_option('#recvD', index=1)
        note = "מותג דמו\nמספר מסמך DEMO1001\nתאריך 17.10.2026\n" + "\n".join("%d\tחולצת כוכב שחורה — %d\t1\t₪110.00\t₪110.00"%(i+1,(i%2)+1) for i in range(2)) + "\nסכום לפני מע\"מ ₪220.00\nמע\"מ ₪39.60\nסה\"כ לתשלום ₪259.60"
        await pg.fill('#rcPaste', note); await pg.click('[data-a=rcparse]'); await pg.wait_for_timeout(200)
        print("dn parse:", (await pg.inner_text('.card:has(#rcPaste)')).replace("\n"," | ")[-200:])
        print("check:", await pg.inner_text('#recvCheck'), "| docNo:", await pg.input_value('#docNo'))
        await pg.click('[data-a=confirmrecv]'); await pg.wait_for_timeout(300)
        print("toast:", await pg.inner_text('#toast'))
        # sale (money off): no price fields
        await pg.click('[data-a=tab][data-t=sell]')
        await pg.click('[data-a=open] >> nth=0'); 
        print("sale sheet has price:", await pg.locator('#sheetPrice').count())
        await pg.click('.sheet .sizebtn:not(.none) >> nth=0'); await pg.click('.sheet [data-a=sell]'); await pg.wait_for_timeout(300)
        print("sale toast:", await pg.inner_text('#toast'))
        # month close
        await pg.click('[data-a=tab][data-t=more]'); await pg.click('[data-a=sub][data-v=close]')
        print("close rows:", await pg.locator('[data-cc]').count())
        await pg.click('[data-a=sub][data-v=report]')
        print("report (money off):", (await pg.inner_text('#view'))[-260:].replace("\n"," | "))
        # backup tab
        await pg.click('[data-a=sub][data-v=backup]'); await pg.click('[data-a=ping]'); await pg.wait_for_timeout(300)
        print("ping:", await pg.inner_text('#pingOut'))
        print("overflow:", await pg.evaluate("document.documentElement.scrollWidth > document.documentElement.clientWidth"))
        await pg.close()
        print("errors:", errs)
        await b.close()
asyncio.run(main())
