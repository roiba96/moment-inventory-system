import asyncio, json
from playwright.async_api import async_playwright
from pathlib import Path
HERE=Path(__file__).resolve().parent
BASE=(HERE.parent/"dist"/"moment-app.html").as_uri()
IMG=str(HERE.parent/"icons"/"icon-192.png")
RES={"doc_no":"DEMO2000","items":[{"model":"חולצה נורית","size":"4","qty":2,"unit_price":100},{"model":"חולצה נורית","size":"5","qty":1,"unit_price":100},{"model":"70003","size":"","qty":2,"unit_price":None}],"unclear":["שורה 4 מטושטשת"]}
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs=[]; reqs=[]
        pg = await (await b.new_context(viewport={"width":390,"height":844})).new_page()
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.route("**/fonts.googleapis.com/**", lambda r: r.abort())
        async def ocr(route):
            body = json.loads(route.request.post_data); reqs.append((route.request.headers.get("authorization"), body["mime"], len(body["image"])))
            await route.fulfill(status=200, content_type="application/json", body=json.dumps(RES), headers={"Access-Control-Allow-Origin":"*"})
        await pg.route("https://ocr.example.com/**", ocr)
        await pg.goto(BASE+"?fake=1"); await pg.wait_for_timeout(400)
        await pg.click('[data-a=tab][data-t=more]'); await pg.click('[data-a=sub][data-v=designers]')
        await pg.fill('#ndName','מעצבת א'); await pg.select_option('#ndScale','N15'); await pg.click('[data-a=adddes]'); await pg.wait_for_timeout(200)
        await pg.click('[data-a=tab][data-t=receive]'); await pg.wait_for_timeout(200)
        print("scan buttons:", await pg.locator('input[data-scan]').count())
        await pg.set_input_files('input[data-scan=recv]', IMG); await pg.wait_for_timeout(1500)
        print("request:", reqs)
        print("lines:", await pg.locator('.rline').count(), "| docNo:", await pg.input_value('#docNo'))
        print("msg:", (await pg.inner_text('#view'))[:500].replace("\n"," | "))
        await pg.click('[data-a=confirmrecv]'); await pg.wait_for_timeout(300); print("toast:", await pg.inner_text('#toast'))
        print("moves:", await pg.evaluate("Object.values(window.__sdk._data.moves).map(m=>m.size+':'+m.delta).sort().join(',')"))
        # return mode scan
        await pg.click('[data-a=rmode][data-v=ret]'); await pg.wait_for_timeout(200)
        RES["items"]=[{"model":"חולצה נורית","size":"4","qty":1,"unit_price":None}]
        await pg.set_input_files('input[data-scan=ret]', IMG); await pg.wait_for_timeout(1500)
        print("return lines:", await pg.locator('[data-a=rtdel]').count(), (await pg.inner_text('#view'))[:300].replace("\n"," | "))
        # error path
        await pg.unroute("https://ocr.example.com/**")
        await pg.route("https://ocr.example.com/**", lambda r: r.fulfill(status=401, content_type="application/json", body='{"error":"auth"}', headers={"Access-Control-Allow-Origin":"*"}))
        await pg.set_input_files('input[data-scan=ret]', IMG); await pg.wait_for_timeout(1500)
        print("auth error msg:", "צריך להיות מחוברת" in await pg.inner_text('#view'))
        print("errors:", errs); await b.close()
asyncio.run(main())
