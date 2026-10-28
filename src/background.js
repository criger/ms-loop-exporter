/* Extension-origin IndexedDB. Nothing is uploaded or forwarded to third parties. */
const DB_NAME = 'loop-board-exporter-local';
const DB_VERSION = 1;
const HOSTS = new Set(['loop.cloud.microsoft', 'loop.microsoft.com']);

function isLoop(url)
{
    try
    {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' && HOSTS.has(parsed.hostname);
    }
    catch { return false; }
}

function openDb()
{
    return new Promise((resolve,reject) =>
    {
        const request = indexedDB.open(DB_NAME,DB_VERSION);
        request.onupgradeneeded = () =>
        {
            const db = request.result;
            if (!db.objectStoreNames.contains('reports'))
                db.createObjectStore('reports',{keyPath:'id'});
            if (!db.objectStoreNames.contains('cards'))
                db.createObjectStore('cards',{keyPath:['reportId','index']});
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

async function withDb(storeName,mode,operation)
{
    const db = await openDb();
    try
    {
        return await new Promise((resolve,reject) =>
        {
            const tx = db.transaction(storeName,mode);
            const store = tx.objectStore(storeName);
            const result = operation(store,resolve,reject);
            tx.oncomplete = () => { if (mode === 'readwrite') resolve(result); };
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
        });
    }
    finally { db.close(); }
}

async function put(storeName,value)
{
    return withDb(storeName,'readwrite',store => store.put(value));
}

async function get(storeName,key)
{
    return withDb(storeName,'readonly',(store,resolve,reject) =>
    {
        const request = store.get(key);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
    });
}

async function readCards(id)
{
    return withDb('cards','readonly',(store,resolve,reject) =>
    {
        const result = [];
        const request = store.openCursor(
            IDBKeyRange.bound([id,0],[id,Number.MAX_SAFE_INTEGER]));
        request.onsuccess = () =>
        {
            const cursor = request.result;
            if (!cursor) return resolve(result);
            result.push(cursor.value.card);
            cursor.continue();
        };
        request.onerror = () => reject(request.error);
    });
}

async function latest()
{
    return withDb('reports','readonly',(store,resolve,reject) =>
    {
        let found = null;
        const request = store.openCursor();
        request.onsuccess = () =>
        {
            const cursor = request.result;
            if (!cursor) return resolve(found);
            if (!found || cursor.value.createdAt > found.createdAt) found = cursor.value;
            cursor.continue();
        };
        request.onerror = () => reject(request.error);
    });
}

async function handle(message,sender)
{
    if (!message || typeof message.type !== 'string') throw new Error('Invalid request');
    const fromLoop = sender.tab && [sender.tab.url,sender.url,sender.origin].some(isLoop);
    const origin = chrome.runtime.getURL('');
    const fromExtension = sender.id === chrome.runtime.id &&
        [sender.url,sender.origin].some(url => typeof url === 'string' && url.startsWith(origin));
    if (['CREATE','CARD','FINISH'].includes(message.type) && !fromLoop)
        throw new Error('Only Microsoft Loop can create exports');
    if (!fromLoop && !fromExtension) throw new Error('Permission denied');

    if (message.type === 'CREATE')
    {
        const id = crypto.randomUUID();
        const createdAt = new Date().toISOString();
        await put('reports',{id,createdAt,state:'running',...message.meta});
        return {id};
    }
    if (message.type === 'CARD')
    {
        if (typeof message.id !== 'string' || !Number.isInteger(message.card?.index))
            throw new Error('Invalid card');
        await put('cards',{reportId:message.id,index:message.card.index,card:message.card});
        return {};
    }
    if (message.type === 'FINISH')
    {
        const report = await get('reports',message.id);
        if (!report) throw new Error('Report not found');
        await put('reports',{...report,...message.meta,state:'finished'});
        await chrome.tabs.create({url:chrome.runtime.getURL('ui/report.html') +
            '?id=' + encodeURIComponent(message.id)});
        return {};
    }
    if (message.type === 'REPORT') return {report:await get('reports',message.id)};
    if (message.type === 'CARDS') return {cards:await readCards(message.id)};
    if (message.type === 'LATEST')
    {
        const report = await latest();
        return {id:report?.id || null};
    }
    if (message.type === 'OPEN')
    {
        const report = message.id ? await get('reports',message.id) : await latest();
        if (!report) throw new Error('No saved export');
        await chrome.tabs.create({url:chrome.runtime.getURL('ui/report.html') +
            '?id=' + encodeURIComponent(report.id)});
        return {};
    }
    throw new Error('Unsupported request: ' + message.type);
}

chrome.runtime.onMessage.addListener((message,sender,sendResponse) =>
{
    handle(message,sender).then(value => sendResponse({ok:true,...value}))
        .catch(error => sendResponse({ok:false,error:String(error.message || error)}));
    return true;
});

chrome.action.onClicked.addListener(async tab =>
{
    try
    {
        if (!tab.id || !isLoop(tab.url))
        {
            await chrome.tabs.create({url:chrome.runtime.getURL('ui/help.html')});
            return;
        }
        await chrome.scripting.executeScript(
        {
            target:{tabId:tab.id},
            files:['src/dates.js','src/extractor.js','src/panel.js']
        });
    }
    catch(error)
    {
        console.error('Loop Exporter:',error);
        await chrome.tabs.create({url:chrome.runtime.getURL('ui/help.html')});
    }
});
