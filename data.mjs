import fetch from "node-fetch";
import { promises as fs } from "fs";
import * as path from "path";
import * as zlib from "zlib"

// run this script to regenerate all the static data


const NATIONAL_DEX_LAST = 1025; // Gen 9's last Dex number (Pecharunt #1025, Feb 2024)
const versionNames = [
    "red",
    "blue",
    "yellow",
    "gold",
    "silver",
    "crystal",
    "ruby",
    "sapphire",
    "emerald",
    "firered",
    "leafgreen",
    "diamond",
    "pearl",
    "platinum",
    "heartgold",
    "soulsilver",
    "black",
    "white",
    "black-2",
    "white-2",
    "x",
    "y",
    "omega-ruby",
    "alpha-sapphire",
    "sun",
    "moon",
    "ultra-sun",
    "ultra-moon",
    "lets-go-pikachu",
    "lets-go-eevee",
    "sword",
    "shield",
    "brilliant-diamond",
    "shining-pearl",
    "legends-arceus",
    "scarlet",
    "violet"
];

const SPRITE_URL = n =>    `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${n}.png`;
const TYPE_ICON_URL = t => `https://raw.githubusercontent.com/partywhale/pokemon-type-icons/main/icons/${t}.svg`;

try {
    //await fs.rm("data", { recursive: true });
} catch { }

const types = new Set();
const dataFile = {};

const pokedexData = await downloadUrl(`https://pokeapi.co/api/v2/pokemon?limit=${NATIONAL_DEX_LAST}`, "./data/pokedex.json", true);

dataFile.entries = {};
let id = 0;
for (const dex of pokedexData.results) {
    id++;
    dataFile.entries[id] = await createDexEntry(id, null, id);

    for (const v of dataFile.entries[id].varieties.filter(v => !v.is_default)) {
        dataFile.entries[v.name] = await createDexEntry(v.name, v.url, id);
    }
}

dataFile.dexList = Object.values(dataFile.entries).filter(e => e.is_default_form).map(p => ({
    id: p.id, name: p.name, sprite: p.sprite, types: p.types
}));

await Promise.all([...types.values()].map(t => downloadUrl(TYPE_ICON_URL(t), `./data/sprites/${t}.svg`)));

async function createDexEntry(id, entryUrl, defaultId) {
    entryUrl = entryUrl || `https://pokeapi.co/api/v2/pokemon/${id}/`;
    const entry = await downloadUrl(entryUrl, `./data/pokemon/${id}.json`, true);
    const species = await downloadUrl(entry.species.url, `./data/pokemon-species/${id}.json`, true);

    await downloadUrl(getSprites(entry), `./data/sprites/${id}.png`, false, true);

    const dexEntry = {
        id: id,
        dex_id: defaultId,
        is_default_form: entry.is_default,
        name: species.names.find(n => n.language.name === "en")?.name ?? entry.name,
        sprite: `./data/sprites/${id}.png`,
        types: entry.types.map(t => t.type.name),
        stats: entry.stats.map(s => ({ name: s.stat.name, base: s.base_stat })),
        height: entry.height / 10,
        weight: entry.weight / 10,
        category: (species.genera.find(g => g.language.name === 'en') || {}).genus || "",
        // flavor_entries: species.flavor_text_entries.filter(f=>f.language.name==='en'),
        version_order: [...species.flavor_text_entries.filter(f => f.language.name === 'en')].sort((a, b) => versionNames.indexOf(a.version.name) - versionNames.indexOf(b.version.name)).map(v => v.version.name),
        flavor_texts: buildFlavourTexts(species),
        varieties: species.varieties.map(v => ({
            id: v.is_default ? defaultId : v.pokemon.name,
            name: v.pokemon.name,
            is_default: v.is_default,
            url: v.pokemon.url
        })),
    };
    
    types.add(...dexEntry.types);

    return dexEntry;
}

function getSprites(entry) {
    const entries = [
        entry.sprites.other?.['official-artwork']?.front_default,
        entry.sprites.other?.['official-artwork']?.front_female,
        entry.sprites.other?.['official-artwork']?.front_shiny,
        entry.sprites.other?.['official-artwork']?.front_shiny_female,
        entry.sprites.front_default,
        entry.sprites.front_female,
        entry.sprites.front_shiny,
        entry.sprites.front_shiny_female,
        SPRITE_URL(id),
    ]
    return entries.filter(e => e);
}

function buildFlavourTexts(species) {
    const ret = {};
    for (const versionName of versionNames) {
        // ret[versionName] = "";
        const entry = species.flavor_text_entries.find(f => f.language.name==='en' && f.version.name === versionName);
        if (entry) {
            ret[versionName] = entry.flavor_text.replace(/\u000c/g, " ").replace(/\s+/g, " ").trim();
        }
    }
    return ret;
}
const jsonResult = JSON.stringify(dataFile, null, 2);
// const deflatedResult = zlib.gzipSync(jsonResult, {
//     level: 9,
// });
// await fs.writeFile("data/pokemon.json.gz", deflatedResult);
await fs.writeFile("data/pokemon.json", jsonResult);

async function downloadUrl(url, puthere, parseJson, okToFail = false) {
    if (!puthere && !parseJson) {
        throw new Error("Why download something if you won't use it?!");
    }

    if (puthere) {
        try {
            await fs.stat(puthere);

            if (parseJson) {
                // console.log("Reusing cached data at", puthere);
                const data = await fs.readFile(puthere);
                return await JSON.parse(data);
            }

            return;
        } catch (e) {
            // console.log(e);
        }
    }

    const dir = path.dirname(puthere);
    try {
        await fs.mkdir(dir, { recursive: true, })
    } catch(e) { console.error(e) }

    const urls = Array.isArray(url) ? url : [url];

    for (const url of urls) {
        console.log("Downloading missing data for", puthere, "from", url);
        const content = await fetch(url);
        console.log(url, "status:", content.status);
        if (!content.ok) {
            console.log("Failed to download", url, "because:", await content.text());
            continue;
        }
        const blob = await content.blob();

        if (puthere) {
            if (parseJson) {
                await fs.writeFile(puthere, JSON.stringify(JSON.parse(await blob.text()), null, 2));
            } else {
                await fs.writeFile(puthere, blob.stream());
            }
        }

        if (parseJson) {
            return JSON.parse(await blob.text());
        }
        return;
    }

    if (!okToFail) {
        throw new Error(`Error downloading content`);
    }
    return null;
}
