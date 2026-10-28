/* Minimal, bilingual Shadow DOM control panel. Loop content never leaves the browser. */
(() =>
{
    'use strict';
    if (globalThis.__loopBoardPanelV06)
    {
        globalThis.__loopBoardPanelV06.show();
        return;
    }

    const engine = globalThis.LoopBoardEngine;
    const labels =
    {
        no:
        {
            tagline:'Fra Loop til rapport, uten mellomledd',
            view:'Gjeldende visning',
            filters:'Aktive Loop-filtre respekteres',
            guideTitle:'Eksporter akkurat det du har filtrert frem',
            guide:'Filtrer kortene i Loop, åpne ett kort og start eksporten. Alle felt og notater følger med.',
            html:'Inkluder original HTML',
            htmlHint:'Gir større JSON-fil. Vanligvis unødvendig for AI.',
            start:'Eksporter {count} kort',
            selected:'{count} kort i gjeldende visning',
            open:'Åpne et kort i Loop først',
            working:'Eksporterer',
            preparing:'Klargjør eksporten …',
            toEdge:'Navigerer til første relevante kort …',
            stop:'Avbryt eksport',
            stopping:'Stopper etter gjeldende operasjon …',
            done:'Ferdig! {count} kort. Rapporten åpnes i en ny fane.',
            partial:'Delvis eksport: {count} av {total} kort. Rapporten åpnes i en ny fane.',
            error:'Eksporten kunne ikke fullføres',
            last:'Åpne forrige rapport',
            offline:'Lokal behandling · ingen AI-tilkobling. Kontroller delingsregler før du limer inn bedriftsinformasjon i en AI.',
            author:'Utviklet av:',
            close:'Lukk eksportpanelet',
            language:'Visningsspråk',
            card:'Kort {index} av {total}'
        },
        en:
        {
            tagline:'From Loop to report, without the middleman',
            view:'Current view',
            filters:'Active Loop filters are respected',
            guideTitle:'Export only the cards you selected',
            guide:'Filter cards in Loop, open any card, then start. All fields and notes are included.',
            html:'Include original HTML',
            htmlHint:'Increases JSON size. Usually unnecessary for AI.',
            start:'Export {count} cards',
            selected:'{count} cards in current view',
            open:'Open a card in Loop first',
            working:'Exporting',
            preparing:'Preparing export…',
            toEdge:'Navigating to the first selected card…',
            stop:'Cancel export',
            stopping:'Stopping after the current operation…',
            done:'Done! {count} cards. Your report opens in a new tab.',
            partial:'Partial export: {count} of {total} cards. Your report opens in a new tab.',
            error:'Export could not be completed',
            last:'Open previous report',
            offline:'Processed locally · no AI integration. Check your organization’s sharing rules before pasting data into an AI.',
            author:'Developed by:',
            close:'Close export panel',
            language:'Display language',
            card:'Card {index} of {total}'
        }
    };
    let language = 'en';
    const t = (key,data={}) => (labels[language][key] || key).replace(/\{(\w+)\}/g,
        (_,name) => String(data[name] ?? ''));
    const request = async message =>
    {
        const response = await chrome.runtime.sendMessage(message);
        if (!response?.ok) throw new Error(response?.error || 'Extension storage error');
        return response;
    };
    const state = {running:false,stopped:false,total:0,processed:0};
    const host = document.createElement('div');
    host.id = 'loop-board-exporter-host-v06';
    const shadow = host.attachShadow({mode:'open'});
    shadow.innerHTML = [
        '<style>',
        ':host{all:initial;position:fixed;z-index:2147483647;top:22px;right:22px;font-family:system-ui,"Segoe UI",sans-serif;color:#183c37}',
        '[hidden]{display:none!important}*{box-sizing:border-box}',
        '.panel{width:350px;max-width:calc(100vw - 28px);max-height:calc(100vh - 30px);overflow-y:auto;',
        'background:#fff;border:1px solid #d8e5e0;border-radius:17px;box-shadow:0 18px 60px #071e2050}',
        '.top{background:#103c35;color:white;padding:22px 20px 20px;position:relative}',
        '.kicker{font-size:11px;letter-spacing:.13em;text-transform:uppercase;color:#b5e2d3;font-weight:700}',
        'h2{font-size:21px;margin:7px 32px 7px 0;line-height:1.2;color:white}',
        '.tag{color:#daeee7;font-size:12px;line-height:1.5;margin:0}',
        '.close{position:absolute;right:12px;top:10px;border:0;background:#ffffff1a;color:white;',
        'border-radius:8px;width:35px;height:35px;font-size:24px;cursor:pointer;line-height:1}',
        '.body{padding:18px 20px 14px}',
        '.selectline{display:flex;gap:9px;align-items:center;justify-content:space-between;font-size:12px;',
        'color:#48665e;margin-bottom:14px}',
        'select{border:1px solid #a9c4ba;border-radius:8px;background:#fff;padding:7px 10px;',
        'color:#193f35;font-size:12px;min-width:110px}',
        '.badge{display:inline-block;background:#ddf7e9;color:#0f6540;font-size:12px;padding:6px 11px;',
        'border-radius:999px;font-weight:750;margin-bottom:9px}',
        '.title{font-size:17px;font-weight:800;word-break:break-word}',
        '.detail{font-size:12px;color:#55736d;margin-top:4px}',
        '.guide{background:#f3f8f6;border:1px solid #e0ece7;border-radius:11px;padding:13px 14px;',
        'margin:16px 0;color:#254c42;font-size:12px;line-height:1.55}',
        '.guide strong{display:block;margin-bottom:4px;font-size:13px}',
        '.guide p{margin:0}',
        '.option{display:flex;align-items:start;gap:10px;margin:12px 0 17px;font-size:12px;cursor:pointer}',
        '.option input{margin-top:3px;accent-color:#087d5d}',
        '.option small{display:block;color:#5d766f;margin-top:3px;font-size:11px}',
        'button{font-family:inherit} .primary{display:block;width:100%;padding:13px 10px;',
        'border:0;background:#0b8661;color:white;border-radius:10px;font-size:14px;',
        'font-weight:800;cursor:pointer;min-height:45px}',
        '.primary:disabled{background:#dce4e2;color:#637672;cursor:not-allowed}',
        '.secondary{width:100%;padding:10px;border-radius:9px;border:1px solid #b7d0c5;',
        'background:#fff;color:#185843;font-weight:700;cursor:pointer}',
        '.progress{margin:15px 0}.line{display:flex;justify-content:space-between;font-size:12px;font-weight:700}',
        '.track{height:8px;background:#deebe6;border-radius:10px;overflow:hidden;margin:9px 0}',
        '.fill{width:0;height:100%;background:#0b8661;transition:width .2s}',
        '.current{min-height:40px;font-size:12px;line-height:1.5;color:#4e6962;overflow-wrap:anywhere}',
        '.message{border-radius:9px;padding:11px;font-size:12px;margin:14px 0;line-height:1.5}',
        '.success{background:#e6f8ee;color:#155f43}.error{background:#fff0ec;color:#8e342d}',
        '.footer{border-top:1px solid #e3eeea;margin-top:16px;padding-top:12px;color:#617970;',
        'font-size:11px;line-height:1.5}',
        '.last{display:block;border:0;background:none;color:#087d5d;padding:10px 0;',
        'font-size:12px;font-weight:750;cursor:pointer}',
        '.credit{margin-top:14px;text-align:center;color:#658078;font-size:11px}',
        '.credit strong{color:#244e40}',
        'button:focus-visible,select:focus-visible,input:focus-visible{outline:3px solid #eea83e;outline-offset:3px}',
        '@media(prefers-reduced-motion:reduce){.fill{transition:none}}',
        '</style>',
        '<section class="panel" role="dialog" aria-modal="false" aria-labelledby="lbe-title">',
        '<header class="top"><div class="kicker">Loop Board Exporter · v0.6</div>',
        '<h2 id="lbe-title">Loop Board Exporter</h2><p class="tag" id="tag"></p>',
        '<button class="close" id="close" type="button">&times;</button></header>',
        '<div class="body">',
        '<label class="selectline" for="language"><span id="langLabel"></span>',
        '<select id="language" aria-label="Display language"><option value="en">English</option>',
        '<option value="no">Norsk</option></select></label>',
        '<div id="badge" class="badge" hidden></div>',
        '<div class="title" id="page"></div><div id="view" class="detail" hidden></div>',
        '<div class="guide" id="guide"><strong id="guideTitle"></strong><p id="guideText"></p></div>',
        '<label class="option" id="htmlOption"><input id="rawHtml" type="checkbox">',
        '<span><span id="htmlLabel"></span><small id="htmlHint"></small></span></label>',
        '<button id="start" class="primary" type="button" disabled></button>',
        '<div id="progress" class="progress" role="status" aria-live="polite" hidden>',
        '<div class="line"><span id="phase"></span><span id="progressCount">0/0</span></div>',
        '<div class="track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">',
        '<div class="fill" id="fill"></div></div><p id="current" class="current"></p>',
        '<button id="stop" class="secondary" type="button"></button></div>',
        '<div id="message" class="message" role="status" aria-live="polite" hidden></div>',
        '<div class="footer"><span id="privacy"></span>',
        '<button id="last" class="last" type="button" hidden></button></div>',
        '<div class="credit"><span id="author"></span> <strong>Cristhian Gertner</strong></div>',
        '</div></section>'
    ].join('');
    document.documentElement.appendChild(host);
    const ui = name => shadow.getElementById(name);

    function translate()
    {
        const ids = {tag:'tagline',langLabel:'language',guideTitle:'guideTitle',
            guideText:'guide',htmlLabel:'html',htmlHint:'htmlHint',stop:'stop',
            last:'last',privacy:'offline',author:'author'};
        for (const [id,key] of Object.entries(ids)) ui(id).textContent = t(key);
        ui('close').setAttribute('aria-label',t('close'));
        ui('language').value = language;
        updateReady();
    }

    function showMessage(message,type)
    {
        ui('message').textContent = message;
        ui('message').className = 'message ' + type;
        ui('message').hidden = false;
    }

    function updateReady()
    {
        if (state.running) return;
        const pos = engine.position();
        const title = document.querySelector('h1')?.textContent || document.title || 'Microsoft Loop';
        ui('page').textContent = title.trim();
        ui('badge').hidden = !pos;
        ui('view').hidden = !pos;
        if (pos)
        {
            ui('badge').textContent = t('selected',{count:pos.total});
            ui('view').textContent = t('card',{index:pos.current,total:pos.total}) + ' · ' + t('filters');
        }
        ui('start').disabled = !pos;
        ui('start').textContent = pos ? t('start',{count:pos.total}) : t('open');
    }

    function hide()
    {
        host.hidden = true;
        host.style.display = 'none';
    }
    function show()
    {
        host.style.display = '';
        host.hidden = false;
        updateReady();
        ui('close').focus();
    }

    globalThis.__loopBoardPanelV06 = {show};
    const timer = setInterval(() =>
    {
        if (!host.isConnected) {clearInterval(timer);return;}
        if (!host.hidden) updateReady();
    },800);
    ui('close').addEventListener('click',hide);
    shadow.addEventListener('keydown',event =>
    {
        if (event.key === 'Escape') {event.preventDefault();hide();}
    });
    ui('language').addEventListener('change',async event =>
    {
        language = event.target.value === 'no' ? 'no' : 'en';
        await chrome.storage.local.set({language});
        translate();
    });
    ui('last').addEventListener('click',async () =>
    {
        try {await request({type:'OPEN'});}
        catch(error) {showMessage(error.message,'error');}
    });
    ui('stop').addEventListener('click',() =>
    {
        state.stopped = true;
        ui('stop').disabled = true;
        ui('current').textContent = t('stopping');
    });

    function progress(done,text)
    {
        ui('progressCount').textContent = done + '/' + state.total;
        const percent = Math.round(100 * done / state.total);
        ui('fill').style.width = percent + '%';
        ui('fill').parentElement.setAttribute('aria-valuenow',String(percent));
        ui('current').textContent = text;
    }

    async function exportBoard()
    {
        if (state.running) return;
        const beginPosition = engine.position();
        if (!beginPosition || beginPosition.total < 1 || beginPosition.total > 10000) return;
        state.running = true;
        state.stopped = false;
        state.total = beginPosition.total;
        state.processed = 0;
        ui('guide').hidden = true;
        ui('htmlOption').hidden = true;
        ui('start').hidden = true;
        ui('message').hidden = true;
        ui('progress').hidden = false;
        ui('stop').disabled = false;
        ui('phase').textContent = t('working');
        progress(0,t('preparing'));

        const started = new Date();
        const rawHtml = ui('rawHtml').checked;
        let reportId = null;
        const warnings = [],errors = [];
        try
        {
            const created = await request({type:'CREATE',meta:
            {
                schema:'loop-board-local-export-v0.6',
                exportedAt:started.toISOString(),
                pageTitle:(document.querySelector('h1')?.textContent || document.title).trim(),
                pageUrl:location.href,
                selection:'Current Loop view (any active filters respected)',
                totalInView:state.total,includeRawHtml:rawHtml
            }});
            reportId = created.id;
            const fromFirst = beginPosition.current-1 <= state.total-beginPosition.current;
            const edge = fromFirst ? 1 : state.total;
            let index = beginPosition.current;
            const stop = () => state.stopped;
            if (index === edge) await engine.waitFor(index,state.total,null,stop);
            else while (index !== edge)
            {
                const next = index + (index < edge ? 1 : -1);
                progress(0,t('toEdge'));
                await engine.move(index < edge ? 'next':'previous',next,state.total,stop);
                index = next;
            }
            for (let offset=0;offset<state.total;offset++)
            {
                if (state.stopped) break;
                const expected = fromFirst ? offset+1 : state.total-offset;
                const card = engine.capture(rawHtml,started);
                if (card.index !== expected) throw new Error('Card index mismatch: ' + expected);
                await request({type:'CARD',id:reportId,card});
                state.processed++;
                if (!card.createdDate) warnings.push('Card ' + expected + ': missing Opprettet');
                const status = card.fields.find(field=>field.name.toLowerCase()==='status')?.value;
                if (typeof status === 'string' && /utført/i.test(status) && !card.completedDate)
                    warnings.push('Card ' + expected + ': completed but missing Utført dato');
                progress(state.processed,card.title || '(Untitled)');
                if (offset < state.total-1 && !state.stopped)
                    await engine.move(fromFirst?'next':'previous',
                        expected+(fromFirst?1:-1),state.total,stop);
            }
        }
        catch(error)
        {
            if (!state.stopped) errors.push(String(error.message || error));
        }
        finally
        {
            const complete = !state.stopped && errors.length === 0 &&
                state.processed === state.total;
            if (reportId)
            {
                try
                {
                    await request({type:'FINISH',id:reportId,meta:
                    {
                        scannedCards:state.processed,exportedCards:state.processed,
                        finishedAt:new Date().toISOString(),complete,warnings,errors
                    }});
                    ui('last').hidden = false;
                    showMessage(complete ? t('done',{count:state.processed}) :
                        t('partial',{count:state.processed,total:state.total}),
                        complete?'success':'error');
                }
                catch(error) {showMessage(t('error') + ': ' + error.message,'error');}
            }
            else showMessage(t('error') + ': ' + (errors[0] || 'Cancelled'),'error');
            state.running = false;
            ui('guide').hidden = false;
            ui('htmlOption').hidden = false;
            ui('start').hidden = false;
            ui('progress').hidden = true;
            updateReady();
        }
    }
    ui('start').addEventListener('click',exportBoard);
    chrome.storage.local.get({language:'en'}).then(async settings =>
    {
        language = settings.language === 'no' ? 'no' : 'en';
        translate();
        const latest = await request({type:'LATEST'});
        ui('last').hidden = !latest.id;
    }).catch(() => translate());
    show();
})();