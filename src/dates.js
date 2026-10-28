/* Local date interpretation for the Loop UI. The source display value is also retained. */
(() =>
{
    'use strict';

    function localDay(date)
    {
        const pad = value => String(value).padStart(2, '0');
        return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());
    }

    function normalizeDate(value, exportedAt = new Date())
    {
        const text = String(value ?? '').trim();
        if (!text || /^(select date|blank)$/i.test(text)) return null;
        const ref = new Date(exportedAt.getFullYear(), exportedAt.getMonth(), exportedAt.getDate(), 12);
        const shift = days =>
        {
            const date = new Date(ref);
            date.setDate(date.getDate() + days);
            return date;
        };
        const exact = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
        if (exact)
        {
            const date = new Date(+exact[1], +exact[2] - 1, +exact[3], 12);
            return date.getFullYear() === +exact[1] && date.getMonth() === +exact[2] - 1 &&
                date.getDate() === +exact[3] ? localDay(date) : null;
        }
        const numeric = text.match(/\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/);
        if (numeric)
        {
            return normalizeDate(numeric[3] + '-' + numeric[2].padStart(2,'0') + '-' +
                numeric[1].padStart(2,'0'), ref);
        }
        if (/^today\b/i.test(text)) return localDay(ref);
        if (/^yesterday\b/i.test(text)) return localDay(shift(-1));
        if (/^tomorrow\b/i.test(text)) return localDay(shift(1));
        const months = {jan:0,feb:1,mar:2,apr:3,may:4,jun:5,jul:6,aug:7,sep:8,oct:9,nov:10,dec:11};
        const month = text.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?\b/i);
        const ago = text.match(/\b(\d+)\s*(?:days?|d)\s+ago\b/i);
        if (month)
        {
            const m = months[month[1].slice(0,3).toLowerCase()];
            const day = +month[2];
            const y = ref.getFullYear();
            const years = month[3] ? [+month[3]] : [y-1,y,y+1];
            const dates = years.map(year => new Date(year,m,day,12))
                .filter(date => date.getMonth() === m && date.getDate() === day);
            if (!dates.length) return null;
            const target = ago ? shift(-Number(ago[1])) : ref;
            if (!ago && !month[3])
            {
                const past = dates.filter(date => date <= ref);
                if (past.length) return localDay(past.sort((a,b) => b-a)[0]);
            }
            return localDay(dates.sort((a,b) => Math.abs(a-target)-Math.abs(b-target))[0]);
        }
        return ago ? localDay(shift(-Number(ago[1]))) : null;
    }

    // Only known tracking/user-specific URL parameters are omitted from AI output.
    // Raw source HTML remains available when explicitly enabled.
    function scrubUrl(raw)
    {
        try
        {
            const url = new URL(raw);
            if (!['https:', 'http:'].includes(url.protocol)) return null;
            for (const name of [...url.searchParams.keys()])
            {
                if (/^(xsdata|sdata|ovuser|utm_.+|fbclid|gclid)$/i.test(name))
                    url.searchParams.delete(name);
            }
            return url.toString();
        }
        catch { return null; }
    }

    globalThis.LoopTools = Object.freeze({localDay, normalizeDate, scrubUrl});
})();