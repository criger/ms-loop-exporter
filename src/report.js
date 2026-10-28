/* Result viewer: independent local JSON, Markdown and Excel CSV. */
(() =>
{
    'use strict';
    const ui = id => document.getElementById(id);
    const labels =
    {
        en:
        {
            title:'Your exported report',language:'Display language',cards:'Cards',fields:'Fields',
            blocks:'Note blocks',status:'Status',complete:'Complete',partial:'Partial',
            hintJson:'Structured export with metadata, fields and notes.',
            hintMarkdown:'AI-ready text; date pills become absolute YYYY-MM-DD dates.',
            hintCsv:'Excel-compatible CSV. Long notes are divided across numbered columns without truncation.',
            copy:'Copy',download:'Download',ready:'Ready to copy or download.',
            copied:'Copied to clipboard.',manualCopy:'Select the text and press Ctrl+C.',
            downloading:'Download started.',credit:'Developed by:',
            privacy:'Nothing is sent to an AI automatically. These exports may contain confidential information. Only share with an AI service approved by your organization.',
            warning:'Some cards may be incomplete. Check the JSON for details.',
            notFound:'Report unavailable. Export again from Loop.'
        },
        no:
        {
            title:'Din eksporterte rapport',language:'Visningsspråk',cards:'Kort',fields:'Felter',
            blocks:'Notatblokker',status:'Status',complete:'Komplett',partial:'Delvis',
            hintJson:'Strukturert eksport med metadata, felter og notater.',
            hintMarkdown:'AI-vennlig tekst der datokomponenter er normalisert til YYYY-MM-DD.',
            hintCsv:'Excel-kompatibel CSV. Lange notater fordeles på nummererte kolonner uten avkorting.',
            copy:'Kopier',download:'Last ned',ready:'Klar til kopiering eller nedlasting.',
            copied:'Kopiert til utklippstavlen.',manualCopy:'Marker teksten og trykk Ctrl+C.',
            downloading:'Nedlasting startet.',credit:'Utviklet av:',
            privacy:'Ingenting sendes automatisk til en AI. Eksporten kan inneholde konfidensiell informasjon. Del bare med AI-tjenester godkjent av virksomheten.',
            warning:'Noen kort kan være ufullstendige. Se JSON for detaljer.',
            notFound:'Rapporten er utilgjengelig. Eksporter på nytt fra Loop.'
        }
    };
    let language='en',mode='json',payload=null;
    const formats={json:{ext:'json',mime:'application/json'},markdown:{ext:'md',mime:'text/markdown'},
        csv:{ext:'csv',mime:'text/csv'}};
    const request = async message =>
    {
        const response = await chrome.runtime.sendMessage(message);
        if (!response?.ok) throw new Error(response?.error || 'Storage unavailable');
        return response;
    };
    const titleSafe = value => String(value || 'loop-board').replace(/[^a-z0-9æøå_-]+/gi,'-')
        .replace(/^-+|-+$/g,'').slice(0,65);
    function currentText()
    {
        if (!payload) return '';
        if (mode === 'json') return JSON.stringify(payload,null,2);
        if (mode === 'csv') return LoopFormats.csv(payload);
        return LoopFormats.markdown(payload,language);
    }
    function translate()
    {
        const label=labels[language];
        document.documentElement.lang=language==='no'?'nb':'en';
        for (const [element,key] of Object.entries(
        {title:'title',langLabel:'language',cardsLabel:'cards',fieldsLabel:'fields',
        blocksLabel:'blocks',statusLabel:'status',copy:'copy',download:'download',
        credit:'credit',privacy:'privacy'}))
            ui(element).textContent=label[key];
        ui('language').value=language;
        ui('status').textContent=payload?(payload.complete?label.complete:label.partial):'—';
        if (payload) render();
    }
    function render()
    {
        for (const name of ['json','markdown','csv'])
        {
            const selected=mode===name;
            ui(name+'Tab').classList.toggle('selected',selected);
            ui(name+'Tab').setAttribute('aria-selected',String(selected));
        }
        ui('hint').textContent=labels[language]['hint'+
            mode.charAt(0).toUpperCase()+mode.slice(1)];
        const value=currentText();
        ui('output').value=value;
        const bytes=new Blob([value]).size;
        ui('size').textContent=(bytes/1024).toLocaleString(language==='no'?'nb-NO':'en-US',
            {maximumFractionDigits:1})+' KB · '+formats[mode].mime;
        ui('feedback').textContent=labels[language].ready;
    }
    for (const name of ['json','markdown','csv'])
        ui(name+'Tab').addEventListener('click',()=>{mode=name;render();});
    ui('language').addEventListener('change',async event=>
    {
        language=event.target.value==='no'?'no':'en';
        await chrome.storage.local.set({language});
        translate();
    });
    ui('copy').addEventListener('click',async ()=>
    {
        try
        {
            await navigator.clipboard.writeText(currentText());
            ui('feedback').textContent=labels[language].copied;
        }
        catch
        {
            ui('output').focus();ui('output').select();
            ui('feedback').textContent=labels[language].manualCopy;
        }
    });
    ui('download').addEventListener('click',()=>
    {
        const info=formats[mode];
        const url=URL.createObjectURL(new Blob([currentText()],
            {type:info.mime+';charset=utf-8'}));
        const link=document.createElement('a');
        link.href=url;
        link.download=titleSafe(payload.pageTitle)+'-'+
            (payload.exportedAt || '').slice(0,10)+'.'+info.ext;
        document.body.append(link);link.click();link.remove();
        setTimeout(()=>URL.revokeObjectURL(url),60000);
        ui('feedback').textContent=labels[language].downloading;
    });
    async function init()
    {
        try
        {
            const stored=await chrome.storage.local.get({language:'en'});
            language=stored.language==='no'?'no':'en';
            const id=new URLSearchParams(location.search).get('id');
            if (!/^[0-9a-f-]{36}$/i.test(id || '')) throw new Error(labels[language].notFound);
            const [meta,data]=await Promise.all([
                request({type:'REPORT',id}),request({type:'CARDS',id})]);
            if (!meta.report) throw new Error(labels[language].notFound);
            const cards=data.cards.sort((a,b)=>a.index-b.index);
            const {id:ignore,createdAt,state,...reportMeta}=meta.report;
            payload={...reportMeta,cards};
            ui('meta').textContent=(payload.pageTitle || 'Microsoft Loop')+' · '+
                new Date(payload.exportedAt).toLocaleString(language==='no'?'nb-NO':'en-US');
            ui('count').textContent=cards.length;
            ui('fieldCount').textContent=cards.reduce((sum,card)=>
                sum+(card.fields?.length || 0),0);
            ui('blockCount').textContent=cards.reduce((sum,card)=>
                sum+(card.notes?.blocks?.length || 0),0);
            if (payload.errors?.length || payload.warnings?.length || !payload.complete)
            {
                ui('notice').hidden=false;
                ui('notice').textContent=labels[language].warning;
            }
            ui('copy').disabled=false;
            ui('download').disabled=false;
            translate();
        }
        catch(error)
        {
            ui('notice').hidden=false;
            ui('notice').textContent=String(error.message || error);
            translate();
        }
    }
    init();
})();