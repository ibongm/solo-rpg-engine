import { describe, it, expect } from 'vitest';
import { sanitizeMediaSkin, mediaSkinOverrides } from './mediaSkin.js';
import { buildSrdCharacter } from './characterBuilder.js';
import { createCampaignFromSeed } from './campaignFactory.js';
import { createCharacter } from './progression.js';
import { buildSkin } from '../config/genreSkins.js';
import { speciesName, className, backgroundName, genreTerms, languageName, availableLanguages } from '../config/srdReskins.js';
import { mockMediaSkin, mockWorldSeed } from '../../api/_lib/mock.js';
import { validateSchema } from '../../api/_lib/validate.js';
import { MEDIA_SKIN_SCHEMA } from '../../api/_lib/schemas.js';

const jericho = () => sanitizeMediaSkin(mockMediaSkin({ mediaTitle: 'Jericho' }));

describe('media skins (TV series / movie)', () => {
  it('mock output satisfies the schema', () => {
    expect(validateSchema(MEDIA_SKIN_SCHEMA, mockMediaSkin({ mediaTitle: 'Jericho' }))).toEqual([]);
  });

  it('keeps names only: drops unknown keys, numbers and bad themes, trims strings', () => {
    const s = sanitizeMediaSkin({
      title: '  Firefly  ',
      theme: 'neon_pink',
      species: { human: { name: 'Browncoat', blurb: 'Lost the war.' }, alien: { name: 'Reaver' }, elf: { name: 42 } },
      classes: { fighter: 'Merc', hacker: 'x' },
      skillLabels: { stealth: 'Sneaking', hp: 99 },
      languages: ['English', 'Mandarin', 'English', 7],
      terms: { spells: 'Gadgets', hitDie: 'd12' },
      maxHp: 500,
    });
    expect(s.title).toBe('Firefly');
    expect(s.theme).toBe('frontier_noir');
    expect(s.species).toEqual({ human: { name: 'Browncoat', blurb: 'Lost the war.' } });
    expect(s.classes).toEqual({ fighter: 'Merc' });
    expect(s.skillLabels).toEqual({ stealth: 'Sneaking' });
    expect(s.languages).toEqual(['English', 'Mandarin']);
    expect(s.terms).toEqual({ spells: 'Gadgets' });
    expect(s.maxHp).toBeUndefined();
    expect(sanitizeMediaSkin({ title: '' })).toBeNull();
    expect(sanitizeMediaSkin(null)).toBeNull();
  });

  it('reskin helpers prefer the media skin, then the genre table, then SRD names', () => {
    const m = jericho();
    expect(speciesName('human', 'tv_movie', m)).toBe('Townsfolk');
    expect(className('fighter', 'tv_movie', m)).toBe('Deputy');
    expect(backgroundName('custom', 'tv_movie', m)).toBe('Custom Background');
    expect(speciesName('human', 'tv_movie')).toBe('Human');
    expect(genreTerms('tv_movie', m).spells).toBe('Know-How');
    expect(languageName('Common', 'tv_movie', m)).toBe('English');
    expect(m.languages).toContain(languageName('Dwarvish', 'tv_movie', m));
    expect(availableLanguages('tv_movie', m)).toEqual(m.languages);
    expect(mediaSkinOverrides(m)).toMatchObject({ currencyLabel: 'Fuel & Salt', skillLabels: { arcana: 'Engineering' } });
  });

  it('builds a character in the universe without changing the rules', () => {
    const base = { name: 'Jake', speciesId: 'human', classId: 'fighter', backgroundId: 'veteran', baseStats: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 }, classSkills: ['perception', 'survival'], fightingStyle: 'defense', equipment: [], currency: 10 };
    const plain = buildSrdCharacter({ ...base, genre: 'fantasy' });
    const tv = buildSrdCharacter({ ...base, genre: 'tv_movie', mediaSkin: jericho() });
    expect(tv.speciesName).toBe('Townsfolk');
    expect(tv.classOrArchetype).toBe('Deputy');
    expect(tv.backgroundName).toBe('Veteran');
    expect(tv.currency.label).toBe('Fuel & Salt');
    expect(tv.languages[0]).toBe('English');
    expect(tv.mediaSkin.title).toBe('Jericho');
    expect(tv.stats).toEqual(plain.stats);
    expect(tv.vitals.maxHp).toBe(plain.vitals.maxHp);
    // A skin is ignored outside the TV / movie genre.
    expect(buildSrdCharacter({ ...base, genre: 'scifi', mediaSkin: jericho() }).mediaSkin).toBeNull();
  });

  it('gives a TV / movie campaign the universe theme and carries the skin', () => {
    const character = createCharacter({ name: 'M', stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } });
    const m = { ...jericho(), theme: 'scifi' };
    const { campaign } = createCampaignFromSeed({ seed: mockWorldSeed({}), character, characterId: 'c1', genre: 'tv_movie', skin: buildSkin('tv_movie', mediaSkinOverrides(m)), seedKey: 'k', mediaSkin: m });
    expect(campaign.meta.themeOverride).toBe('scifi');
    expect(campaign.meta.mediaSkin.title).toBe('Jericho');
    expect(campaign.skin.currencyLabel).toBe('Fuel & Salt');
  });
});
