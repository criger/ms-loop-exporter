/* Pure renderers for AI-friendly Markdown and Excel-compatible CSV. */
(() =>
{
    'use strict';
    const clean = value => String(value ?? '').trim();
    const printable = value => Array.isArray(value) ? value.join(', ') :
        value === null || value === undefined ? '' : String(value);
    function safeUrl(url)
    {
        try
        {
            const parsed = new URL(url);
            if (!['https:','http:'].includes(parsed.protocol)) return url;
            for (const key of [...parsed.searchParams.keys()])
                if (/^(xsdata|sdata|ovuser|utm_.+|fbclid|gclid)$/i.test(key))
                    parsed.searchParams.delete(key);
            return parsed.toString();
        }
        catch {return url;}
    }
    function normalizeLegacyNotes(card)
    {
        // v0.6 already stores canonical dates inside the note Markdown.
        // Older exports can be rendered correctly without rewriting their original JSON.
        let notes = clean(card.notes?.markdown);
        if (!card.notes?.datePillsNormalized)
        {
            for (const item of card.notes?.dates || [])
            {
                if (!item.displayValue || !item.normalizedDate) continue;
                notes = notes.split(item.displayValue).join(item.normalizedDate);
            }
        }
        // Sanitize known SharePoint tracking parameters from earlier exports too.
        return notes.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
            (_,label,url) => '[' + label + '](' + safeUrl(url) + ')');
    }

    function markdown(report,language)
    {
        const en = language !== 'no';
        const lines = [
            en ? '# Microsoft Loop – activity report' : '# Microsoft Loop – aktivitetsrapport',
            '',
            '**' + (en?'Board':'Side') + ':** ' + (report.pageTitle || 'Microsoft Loop'),
            '**' + (en?'Exported':'Eksportert') + ':** ' + (report.exportedAt || ''),
            '**' + (en?'Selection':'Utvalg') + ':** ' + (en?
                'Current Loop view (may be filtered)' : 'Gjeldende Loop-visning (kan være filtrert)'),
            '**' + (en?'Cards':'Antall kort') + ':** ' + report.cards.length,
            '',
            '> ' + (en ?
                'Snapshot of the selected cards, not a full edit history. Dates in notes are absolute ISO dates when recognized.' :
                'Øyeblikksbilde av valgte kort, ikke en full redigeringslogg. Datoer i notater er normalisert til ISO når de gjenkjennes.'),
            '',
            '---',''
        ];
        for (const [index,card] of report.cards.entries())
        {
            lines.push('## ' + (index+1) + '. ' + (card.title || '(Untitled)'),'');
            if (card.createdDate) lines.push('- **' + (en?'Created':'Opprettet') + ':** ' + card.createdDate);
            if (card.completedDate) lines.push('- **' + (en?'Completed':'Utført dato') + ':** ' + card.completedDate);
            for (const field of card.fields || [])
            {
                if (['title','opprettet','utført dato'].includes((field.name || '').toLowerCase()))
                    continue;
                lines.push('- **' + field.name + ':** ' +
                    (printable(field.normalizedDate || field.value) || '—'));
            }
            lines.push('',en?'### Notes and updates':'### Notater og oppdateringer','',
                normalizeLegacyNotes(card) || (en?'No notes.':'Ingen notater.'),'','---','');
        }
        return lines.join('\n');
    }

    function formulaSafe(value)
    {
        // Excel/Calc may execute spreadsheet formulas from untrusted text.
        // A leading apostrophe is text protection. Do not strip it on import.
        const text = String(value ?? '');
        return /^[\s\u0000-\u001f]*[=+\-@]/.test(text) ? "'" + text : text;
    }

    function csvCell(value)
    {
        return '"' + formulaSafe(value).replace(/"/g,'""') + '"';
    }

    function csv(report)
    {
        const fieldNames = [...new Set(report.cards.flatMap(card =>
            (card.fields || []).map(field=>field.name).filter(name =>
                !['title','opprettet','utført dato'].includes((name || '').toLowerCase()))))];
        // Excel cells are limited to 32,767 characters. Split long notes into 30K columns.
        const chunkSize = 30000;
        const parts = report.cards.map(card =>
        {
            const text = normalizeLegacyNotes(card);
            const chunks = [];
            for (let index=0;index<text.length;index+=chunkSize)
                chunks.push(text.slice(index,index+chunkSize));
            return chunks.length ? chunks : [''];
        });
        const maxParts = Math.max(1,...parts.map(p=>p.length));
        const headers = ['Title','Created','Completed',...fieldNames,
            ...Array.from({length:maxParts},(_,i)=>'Notes '+(i+1))];
        const rows = [headers];
        for (const [index,card] of report.cards.entries())
        {
            const values = (card.fields || []).reduce((map,field) =>
            {
                map.set(field.name,printable(field.normalizedDate || field.value));
                return map;
            },new Map());
            rows.push([card.title || '',card.createdDate || '',card.completedDate || '',
                ...fieldNames.map(name=>values.get(name) || ''),
                ...Array.from({length:maxParts},(_,i)=>parts[index][i] || '')]);
        }
        // UTF-8 BOM enables reliable Excel opening for Norwegian names and punctuation.
        return '\uFEFF' + rows.map(row=>row.map(csvCell).join(',')).join('\r\n') + '\r\n';
    }

    globalThis.LoopFormats = Object.freeze({markdown,csv,normalizeLegacyNotes,csvCell});
})();