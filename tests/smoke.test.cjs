const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load(file)
{
    const sandbox = {URL,Date,console};
    sandbox.globalThis = sandbox;
    vm.runInNewContext(fs.readFileSync(path.join(__dirname,'..','src',file),'utf8'),sandbox);
    return sandbox;
}

test('date pills normalize relative days against local export date',() =>
{
    const {LoopTools} = load('dates.js');
    const ref = new Date(2026,9,28,12);
    assert.equal(LoopTools.normalizeDate('Today',ref),'2026-10-28');
    assert.equal(LoopTools.normalizeDate('Yesterday',ref),'2026-10-27');
    assert.equal(LoopTools.normalizeDate('Tomorrow',ref),'2026-10-29');
    assert.equal(LoopTools.normalizeDate('Wednesday, October 21 (7 days ago)',ref),'2026-10-21');
    assert.equal(LoopTools.normalizeDate('Tuesday, October 6',ref),'2026-10-06');
    assert.equal(LoopTools.normalizeDate('29.02.2026',ref),null);
    assert.equal(LoopTools.normalizeDate('Select date',ref),null);
});

test('known tracking parameters are excluded from readable links',() =>
{
    const {LoopTools} = load('dates.js');
    assert.equal(LoopTools.scrubUrl('https://x.test/page?ovuser=person&sdata=secret&id=42'),
        'https://x.test/page?id=42');
    assert.equal(LoopTools.scrubUrl('javascript:alert(1)'),null);
});

function formats()
{
    return load('formats.js').LoopFormats;
}
function example(notes='**Updated** Yesterday')
{
    return {
        pageTitle:'Temabrett',exportedAt:'2026-10-28T13:46:21.364Z',
        cards:[{
            index:1,title:'=SUM(1,1)',createdDate:'2026-10-27',completedDate:null,
            fields:[{name:'Title',value:'=SUM(1,1)'},{name:'Status',value:'Planned'},
                {name:'Ansvarlig',value:['Person One','Person Two']}],
            notes:{markdown:notes,dates:[{displayValue:'Yesterday',normalizedDate:'2026-10-27'}]}
        }]
    };
}

test('Markdown converts legacy relative note dates and cleans URLs',() =>
{
    const f = formats();
    const text = f.markdown(example(
        '**Updated** Yesterday\n[Internal](https://x.test/doc?ovuser=user&sdata=value&id=9)'),'en');
    assert.match(text,/\*\*Updated\*\* 2026-10-27/);
    assert.doesNotMatch(text,/ovuser|sdata/);
    assert.match(text,/https:\/\/x\.test\/doc\?id=9/);
});

test('CSV is quoted UTF-8 BOM, protects formulas and supports multiple owners',() =>
{
    const text = formats().csv(example());
    assert.equal(text.codePointAt(0),0xFEFF);
    assert.ok(text.includes('"\'=SUM(1,1)"'));
    assert.ok(text.includes('"Person One, Person Two"'));
    assert.ok(text.includes('2026-10-27'));
});

test('CSV splits long note text without truncation',() =>
{
    const long = 'A'.repeat(61000);
    const text = formats().csv(example(long));
    assert.ok(text.includes('"Notes 1","Notes 2","Notes 3"'));
    assert.equal((text.match(/A/g)||[]).length,61000);
    assert.ok(text.includes('"'+('A'.repeat(30000))+'"'));
});
