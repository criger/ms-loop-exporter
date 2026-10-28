/* Loop DOM reader and navigator. No APIs, fetches, tokens or Loop writes. */
(() =>
{
    'use strict';
    const T = globalThis.LoopTools;
    const id = name => '[data-testid="' + name + '"]';
    const NOTE = id('detailPageComponentTestId') + ' [aria-label="Additional notes and comments"]';
    const pause = ms => new Promise(resolve => setTimeout(resolve,ms));
    const clean = value => String(value ?? '').replace(/\u00a0/g,' ').replace(/[ \t]+/g,' ').trim();

    function dialog()
    {
        return document.querySelector('[role="dialog"][aria-label="Card details"]') ||
            document.querySelector(id('detailCardNextButtonDataTestId'))?.closest('[role="dialog"]');
    }

    function position()
    {
        const root = dialog();
        if (!root) return null;
        const label = root.querySelector(id('detailCardNextButtonDataTestId'))?.getAttribute('aria-label') ||
            root.querySelector(id('detailCardPreviousButtonDataTestId'))?.getAttribute('aria-label') || '';
        const match = label.match(/(\d+)\s+(?:of|av)\s+(\d+)/i);
        return match ? {current:+match[1],total:+match[2]} : null;
    }

    function signature(root)
    {
        const fields = root.querySelector(id('detailCardWrapperTestId'));
        const note = root.querySelector(NOTE);
        return [fields?.textContent || '',note?.textContent || '',note?.innerHTML.length ?? -1].join('|');
    }

    async function waitFor(index,total,prior,isStopped)
    {
        const started = performance.now();
        let previous = null,stableSince = null;
        while (performance.now()-started < 16000)
        {
            if (isStopped()) throw new Error('Export cancelled');
            const root = dialog(), p = position();
            const ready = root && p?.current === index && p.total === total &&
                root.querySelector(id('cardFieldTestId')) &&
                root.querySelector(id('detailPageComponentTestId'));
            if (ready)
            {
                const current = signature(root);
                if (prior !== null && current === prior) stableSince = null;
                else if (current !== previous) stableSince = performance.now();
                previous = current;
                if (stableSince !== null && performance.now()-stableSince >= 450 &&
                    performance.now()-started >= 350) return;
            }
            else {previous = null;stableSince = null;}
            await pause(90);
        }
        throw new Error('Card ' + index + ' timed out or Loop filter changed');
    }

    async function move(direction,index,total,isStopped)
    {
        const root = dialog();
        if (!root) throw new Error('Card dialog closed');
        const button = root.querySelector(id(direction === 'next'
            ? 'detailCardNextButtonDataTestId' : 'detailCardPreviousButtonDataTestId'));
        if (!button || button.disabled || button.getAttribute('aria-disabled') === 'true')
            throw new Error('Cannot navigate ' + direction);
        const before = signature(root);
        button.click();
        await waitFor(index,total,before,isStopped);
    }

    function cleanClone(copy,exportDate)
    {
        copy.querySelectorAll(id('resolvedAtMention')).forEach(element =>
        {
            const name = clean(element.querySelector(id('displayNameTextField'))?.textContent ||
                element.querySelector('[role="img"][aria-label]')?.getAttribute('aria-label'));
            element.replaceWith(document.createTextNode(name ? '@' + name : '[person]'));
        });
        copy.querySelectorAll(id('diasWrapperTestId')).forEach(element =>
        {
            const display = clean(element.getAttribute('aria-label') ||
                element.querySelector(id('diasTextFieldTestId'))?.textContent);
            // Notes use a canonical absolute date, including Today/Yesterday/Tomorrow.
            element.replaceWith(document.createTextNode(T.normalizeDate(display,exportDate) || display));
        });
        copy.querySelectorAll('.scriptor-blocks-commands-hover,.scriptor-highlightWrapper,' +
            '.scriptor-block-commands-aria-div,squiggler,style,svg,button')
            .forEach(element => element.remove());
    }

    function inlineMarkdown(node)
    {
        if (node.nodeType === Node.TEXT_NODE) return node.textContent || '';
        if (node.nodeType !== Node.ELEMENT_NODE) return '';
        if (node.matches('br.scriptor-EOP,squiggler,style,svg,button')) return '';
        if (node.matches('img'))
            return node.getAttribute('alt') ? '![' + node.getAttribute('alt') + ']' : '[Image]';
        const inner = [...node.childNodes].map(inlineMarkdown).join('');
        if (node.matches('a[href],.scriptor-hyperlink'))
        {
            const source = node.getAttribute('href') || (node.getAttribute('title') || '').split('\n')[0];
            const url = T.scrubUrl(source);
            if (url) return '[' + (inner.trim() || url) + '](' + url + ')';
        }
        const style = node.getAttribute('style') || '';
        const wrap = (mark) => inner.replace(/^(\s*)([\s\S]*?)(\s*)$/,
            (_,a,b,c) => a + mark + b + mark + c);
        if (inner.trim() && (node.matches('b,strong') ||
            /font-weight:\s*(?:600|700|800|900|bold)/i.test(style))) return wrap('**');
        if (inner.trim() && (node.matches('i,em') ||
            /font-style:\s*italic/i.test(style))) return wrap('*');
        return inner;
    }

    function extractNotes(root,rawHtml,exportDate)
    {
        const editor = root.querySelector(NOTE);
        if (!editor) return {found:false,blocks:[],markdown:'',dates:[]};
        const dates = [...editor.querySelectorAll(id('diasWrapperTestId'))].map(element =>
        {
            const displayValue = clean(element.getAttribute('aria-label') || element.textContent);
            return {displayValue,normalizedDate:T.normalizeDate(displayValue,exportDate)};
        });
        const copy = editor.cloneNode(true);
        cleanClone(copy,exportDate);
        const paragraphs = [...copy.querySelectorAll('.scriptor-pageBody .scriptor-paragraph')];
        const blocks = paragraphs.map((paragraph,index) =>
        {
            const li = paragraph.querySelector('li');
            const target = li || paragraph;
            const level = li ? Number(li.getAttribute('aria-level') || 1) : null;
            const numbered = !!li && (!!li.closest('ol') || /number|decimal|ordered/i.test(li.className));
            const marker = !li ? '' : '  '.repeat(Math.max(0,level-1)) +
                (numbered ? (li.getAttribute('aria-posinset') || 1) + '. ' : '- ');
            const block = {index,type:li?(numbered?'numbered-list-item':'bullet-list-item'):'paragraph',
                level,text:clean(target.textContent),
                markdown:marker + clean(inlineMarkdown(target))};
            if (rawHtml) block.html = paragraph.outerHTML;
            return block;
        });
        const result = {found:true,blocks,dates,markdown:blocks.map(block => block.markdown).join('\n')};
        if (rawHtml) result.html = [...copy.querySelectorAll('.scriptor-pageBody')].map(el=>el.innerHTML).join('\n');
        return result;
    }

    function extractFields(root,rawHtml,exportDate)
    {
        const rows = [...root.querySelectorAll(id('detailCardWrapperTestId') + ' ' + id('cardFieldTestId'))];
        return rows.map(row =>
        {
            const header = row.querySelector(id('fieldHeaderTestId'));
            const valueEl = row.querySelector(id('fieldValueTestId'));
            const name = clean(header?.getAttribute('aria-label') || header?.textContent || '[Unknown]');
            const aria = header?.querySelector('[role="textbox"][aria-label]')?.getAttribute('aria-label') || '';
            const type = aria.startsWith(name + ', ') ? aria.slice(name.length+2) : null;
            const inlineDates = [...(valueEl?.querySelectorAll(id('diasWrapperTestId')) || [])].map(el =>
            {
                const displayValue = clean(el.getAttribute('aria-label') ||
                    el.querySelector(id('diasTextFieldTestId'))?.textContent);
                return {displayValue,normalizedDate:T.normalizeDate(displayValue,exportDate)};
            });
            const labels = [...(valueEl?.querySelectorAll(id('label-pill-test-id')) || [])]
                .map(el=>clean(el.textContent)).filter(Boolean);
            const people = [...(valueEl?.querySelectorAll(id('resolvedAtMention')) || [])]
                .map(el=>clean(el.querySelector(id('displayNameTextField'))?.textContent ||
                    el.querySelector('[role="img"][aria-label]')?.getAttribute('aria-label')))
                .filter(Boolean);
            const placeholder = clean(valueEl?.querySelector(id('dateCellTextTestId'))?.textContent);
            const copy = valueEl?.cloneNode(true);
            if (copy) cleanClone(copy,exportDate);
            const fallback = clean(copy?.querySelector('.scriptor-pageBody')?.textContent || copy?.textContent);
            const isDate = type?.toLowerCase() === 'date' ||
                Boolean(valueEl?.querySelector(id('dateCellWrapperTestId')));
            let value = null,normalizedDate = null;
            if (labels.length) value = labels.length === 1 ? labels[0] : labels;
            else if (people.length || type?.toLowerCase() === 'person')
                value = people.length > 1 ? people : people[0] || null;
            else if (isDate)
            {
                const display = inlineDates[0]?.displayValue || placeholder;
                value = display && !/^select date$/i.test(display) ? display : null;
                normalizedDate = value ? T.normalizeDate(value,exportDate) : null;
            }
            else value = fallback || null;
            const result = {name,type,value,normalizedDate,inlineDates};
            const fluidId = valueEl?.querySelector(id('fluidComponentNestedCellTestId'))?.getAttribute('data-fluid-id');
            if (fluidId) result.fluidId = fluidId;
            if (rawHtml) result.html = valueEl?.outerHTML || '';
            return result;
        });
    }

    function capture(rawHtml,exportDate)
    {
        const root = dialog(), p = position();
        if (!root || !p) throw new Error('Card dialog unavailable');
        const fields = extractFields(root,rawHtml,exportDate);
        const field = name => fields.find(item => item.name.toLowerCase() === name.toLowerCase());
        const title = field('Title');
        const created = field('Opprettet');
        const done = field('Utført dato');
        return {
            index:p.current,
            title:title?.value || null,
            cardKeyCandidate:title?.fluidId || null,
            createdDate:created?.normalizedDate || null,
            createdDateDisplay:created?.value || null,
            completedDate:done?.normalizedDate || null,
            completedDateDisplay:done?.value || null,
            fields,
            notes:extractNotes(root,rawHtml,exportDate)
        };
    }

    globalThis.LoopBoardEngine = Object.freeze({position,waitFor,move,capture,clean});
})();