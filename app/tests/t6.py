import asyncio
from playwright.async_api import async_playwright
from pathlib import Path
HERE=Path(__file__).resolve().parent
BASE=(HERE.parent/"dist"/"moment-app.html").as_uri()
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); ctx = await b.new_context(viewport={"width":400,"height":820}); pg = await ctx.new_page()
        await pg.route("**/fonts.googleapis.com/**", lambda r: r.abort())
        await pg.goto(BASE+"?demo=1"); await pg.wait_for_timeout(600)
        await pg.click('[data-a=tab][data-t=more]'); await pg.click('[data-a=sub][data-v=close]')
        await pg.fill('[data-cc] >> nth=0', '7'); await pg.wait_for_timeout(100)
        await pg.reload(); await pg.wait_for_timeout(600)
        await pg.click('[data-a=tab][data-t=more]'); await pg.click('[data-a=sub][data-v=close]')
        print("restored after reload:", await pg.input_value('[data-cc] >> nth=0'))
        await b.close()
asyncio.run(main())
